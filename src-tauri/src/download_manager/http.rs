use reqwest::{header::RANGE, Client};
use std::sync::Arc;
use std::time::Instant;
use tauri::Emitter;
use tokio::fs::{File, OpenOptions};
use tokio::io::AsyncWriteExt;
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;

use super::queue::Permits;

#[derive(Clone)]
pub struct HttpDownloader {
    client: Client,
    permits: Permits,
    speed_limit: Arc<RwLock<u64>>,
}

impl HttpDownloader {
    pub fn new(permits: Permits, speed_limit: Arc<RwLock<u64>>) -> Self {
        let client = Client::builder()
            .user_agent("BestDownloadManager/1.0 (FOSS)")
            .build()
            .expect("Failed to build HTTP client");

        Self { client, permits, speed_limit }
    }

    pub async fn start_download(
        &self,
        app_handle: tauri::AppHandle,
        task_id: String,
        url: String,
        destination: String,
        token: CancellationToken,
        speed_limit: Arc<RwLock<u64>>,
    ) -> Result<(), String> {
        let client = self.client.clone();
        let sem = self.permits.read().unwrap().clone();

        tokio::spawn(async move {
            let _ = app_handle.emit(
                "download_progress",
                serde_json::json!({
                    "taskId": task_id,
                    "status": "queued",
                    "totalBytes": 0,
                    "downloadedBytes": 0,
                    "speedBytesPerSec": 0
                }),
            );

            let _permit = match sem.acquire_owned().await {
                Ok(p) => p,
                Err(_) => {
                    let _ = app_handle.emit(
                        "download_progress",
                        serde_json::json!({
                            "taskId": task_id,
                            "status": "error",
                            "errorMessage": "Download queue was shut down",
                            "totalBytes": 0,
                            "downloadedBytes": 0,
                            "speedBytesPerSec": 0
                        }),
                    );
                    return;
                }
            };

            run_download(
                &client,
                &app_handle,
                &task_id,
                &url,
                &destination,
                token,
                speed_limit,
            )
            .await;
        });

        Ok(())
    }
}

async fn run_download(
    client: &Client,
    app_handle: &tauri::AppHandle,
    task_id: &str,
    url: &str,
    destination: &str,
    token: CancellationToken,
    speed_limit: Arc<RwLock<u64>>,
) {
    let part_path = format!("{}.part", destination);

    let mut downloaded_bytes: u64 = 0;
    let partial_mode = match tokio::fs::metadata(&part_path).await {
        Ok(meta) if meta.is_file() => {
            downloaded_bytes = meta.len();
            true
        }
        _ => false,
    };

    let mut req = client.get(url);
    if partial_mode && downloaded_bytes > 0 {
        req = req.header(RANGE, format!("bytes={}-", downloaded_bytes));
    }

    let res = match req.send().await {
        Ok(r) => r,
        Err(e) => {
            emit_error(
                app_handle,
                task_id,
                &format!("Failed to start request: {}", e),
                downloaded_bytes,
            );
            return;
        }
    };

    let status = res.status();

    if status == reqwest::StatusCode::RANGE_NOT_SATISFIABLE && partial_mode {
        drop(res);
        if tokio::fs::rename(&part_path, &destination).await.is_err() {
            let _ = tokio::fs::remove_file(&destination).await;
            let _ = tokio::fs::rename(&part_path, &destination).await;
        }
        let _ = app_handle.emit(
            "download_progress",
            serde_json::json!({
                "taskId": task_id,
                "filename": std::path::Path::new(destination)
                    .file_name()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default(),
                "status": "completed",
                "totalBytes": downloaded_bytes,
                "downloadedBytes": downloaded_bytes,
                "speedBytesPerSec": 0
            }),
        );
        return;
    }

    let resuming = status == reqwest::StatusCode::PARTIAL_CONTENT;
    if partial_mode && !resuming {
        downloaded_bytes = 0;
    }

    let overall_total: u64 = if resuming {
        if let Some(total) = res
            .headers()
            .get(reqwest::header::CONTENT_RANGE)
            .and_then(|v| v.to_str().ok())
            .and_then(content_range_total)
        {
            total
        } else {
            let remaining = content_length(&res).unwrap_or(0);
            downloaded_bytes.saturating_add(remaining)
        }
    } else {
        content_length(&res).unwrap_or(0)
    };

    // Make sure the destination directory exists.
    if let Some(parent) = std::path::Path::new(destination).parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }

    let mut file = if resuming {
        match OpenOptions::new().append(true).open(&part_path).await {
            Ok(f) => f,
            Err(e) => {
                emit_error(
                    app_handle,
                    task_id,
                    &format!("Failed to open partial file: {}", e),
                    downloaded_bytes,
                );
                return;
            }
        }
    } else {
        match File::create(&part_path).await {
            Ok(f) => f,
            Err(e) => {
                emit_error(
                    app_handle,
                    task_id,
                    &format!("Failed to create file: {}", e),
                    0,
                );
                return;
            }
        }
    };

    let _ = app_handle.emit(
        "download_progress",
        serde_json::json!({
            "taskId": task_id,
            "filename": std::path::Path::new(destination)
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default(),
            "status": "downloading",
            "totalBytes": overall_total,
            "downloadedBytes": downloaded_bytes,
            "speedBytesPerSec": 0
        }),
    );

    let mut last_emit = Instant::now();
    let mut bytes_since_last_emit: u64 = 0;
    // For rate limiting: track bytes written in the current 1-second window.
    let mut rate_window_start = Instant::now();
    let mut bytes_in_window: u64 = 0;
    let mut res_mut = res;

    loop {
        tokio::select! {
            biased;
            _ = token.cancelled() => {
                let _ = file.flush().await;
                let _ = app_handle.emit(
                    "download_progress",
                    serde_json::json!({
                        "taskId": task_id,
                        "status": "paused",
                        "totalBytes": overall_total,
                        "downloadedBytes": downloaded_bytes,
                        "speedBytesPerSec": 0
                    }),
                );
                return;
            }
            chunk = res_mut.chunk() => {
                match chunk {
                    Ok(Some(c)) => {
                        if let Err(e) = file.write_all(&c).await {
                            let _ = file.flush().await;
                            emit_error(
                                app_handle,
                                task_id,
                                &format!("Failed to write file: {}", e),
                                downloaded_bytes,
                            );
                            return;
                        }
                        let len = c.len() as u64;
                        downloaded_bytes += len;
                        bytes_since_last_emit += len;
                        bytes_in_window += len;

                        // -- Rate limiting (token-bucket per second) --
                        let limit = *speed_limit.read().await;
                        if limit > 0 {
                            let window_elapsed = rate_window_start.elapsed();
                            if window_elapsed.as_secs_f64() < 1.0 {
                                // Within the current 1-second window: have we exceeded the cap?
                                if bytes_in_window > limit {
                                    let remaining_window_ms =
                                        ((1.0 - window_elapsed.as_secs_f64()) * 1000.0) as u64;
                                    if remaining_window_ms > 0 {
                                        tokio::time::sleep(
                                            tokio::time::Duration::from_millis(remaining_window_ms),
                                        )
                                        .await;
                                    }
                                    rate_window_start = Instant::now();
                                    bytes_in_window = 0;
                                }
                            } else {
                                // New second window
                                rate_window_start = Instant::now();
                                bytes_in_window = len;
                            }
                        }

                        let now = Instant::now();
                        let elapsed = now.duration_since(last_emit).as_millis();
                        if elapsed >= 200 {
                            let speed = (bytes_since_last_emit as f64
                                / (elapsed as f64 / 1000.0)) as u64;
                            let _ = app_handle.emit(
                                "download_progress",
                                serde_json::json!({
                                    "taskId": task_id,
                                    "status": "downloading",
                                    "totalBytes": overall_total,
                                    "downloadedBytes": downloaded_bytes,
                                    "speedBytesPerSec": speed
                                }),
                            );
                            last_emit = now;
                            bytes_since_last_emit = 0;
                        }
                    }
                    Ok(None) => break,
                    Err(e) => {
                        let _ = file.flush().await;
                        emit_error(
                            app_handle,
                            task_id,
                            &format!("Stream error: {}", e),
                            downloaded_bytes,
                        );
                        return;
                    }
                }
            }
        }
    }

    let _ = file.flush().await;
    let rename_result = tokio::fs::rename(&part_path, &destination).await;
    if let Err(e) = rename_result {
        let _ = tokio::fs::remove_file(&destination).await;
        if let Err(e2) = tokio::fs::rename(&part_path, &destination).await {
            emit_error(
                app_handle,
                task_id,
                &format!("Downloaded but could not finalize file: {}", e2),
                downloaded_bytes,
            );
            return;
        }
        let _ = e;
    }

    let _ = app_handle.emit(
        "download_progress",
        serde_json::json!({
            "taskId": task_id,
            "filename": std::path::Path::new(destination)
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default(),
            "status": "completed",
            "totalBytes": overall_total,
            "downloadedBytes": downloaded_bytes,
            "speedBytesPerSec": 0
        }),
    );
}

fn content_length(res: &reqwest::Response) -> Option<u64> {
    res.headers()
        .get(reqwest::header::CONTENT_LENGTH)
        .and_then(|val| val.to_str().ok())
        .and_then(|val| val.parse::<u64>().ok())
}

fn content_range_total(value: &str) -> Option<u64> {
    let after_slash = value.rsplit('/').next()?;
    let trimmed = after_slash.trim();
    if trimmed == "*" {
        None
    } else {
        trimmed.parse::<u64>().ok()
    }
}

fn emit_error(app_handle: &tauri::AppHandle, task_id: &str, message: &str, downloaded_bytes: u64) {
    let _ = app_handle.emit(
        "download_progress",
        serde_json::json!({
            "taskId": task_id,
            "status": "error",
            "errorMessage": message,
            "totalBytes": 0,
            "downloadedBytes": downloaded_bytes,
            "speedBytesPerSec": 0
        }),
    );
}
