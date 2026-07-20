use reqwest::{header::RANGE, Client};
use std::time::Instant;
use tauri::Emitter;
use tokio::fs::{File, OpenOptions};
use tokio::io::AsyncWriteExt;
use tokio_util::sync::CancellationToken;

use super::queue::Permits;

#[derive(Clone)]
pub struct HttpDownloader {
    client: Client,
    permits: Permits,
}

impl HttpDownloader {
    pub fn new(permits: Permits) -> Self {
        let client = Client::builder()
            .user_agent("BestDownloadManager/1.0 (FOSS)")
            .build()
            .expect("Failed to build HTTP client");

        Self { client, permits }
    }

    /// Starts an HTTP download. Supports resume via HTTP Range: the file is
    /// streamed to `<destination>.part` and only renamed to `destination` once
    /// it completes cleanly. If a `.part` from a previous (paused/failed) run
    /// exists, the download continues from where it left off (206) or restarts
    /// from the beginning if the server ignores ranges (200).
    pub async fn start_download(
        &self,
        app_handle: tauri::AppHandle,
        task_id: String,
        url: String,
        destination: String,
        token: CancellationToken,
    ) -> Result<(), String> {
        let client = self.client.clone();
        let sem = self.permits.read().unwrap().clone();

        tokio::spawn(async move {
            // Count this task against the concurrency limit; emit "queued"
            // while we wait for a slot.
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
) {
    let part_path = format!("{}.part", destination);

    // How much of the previous run is still on disk? That's our resume offset.
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

    // 416 Range Not Satisfiable with an existing partial means the part already
    // reached the end of the file (this happens when an earlier run finished
    // downloading but the .part -> destination rename failed). Finalize it
    // instead of redownloading from zero.
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

    // 206 Partial Content => the server honored our Range and we can append.
    // Anything else (e.g. 200) => start over from byte 0.
    let resuming = status == reqwest::StatusCode::PARTIAL_CONTENT;
    if partial_mode && !resuming {
        // Stale or unsupported - start fresh from byte 0.
        downloaded_bytes = 0;
    }

    // Resolve the total size of the file for the UI.
    let overall_total: u64 = if resuming {
        // Try Content-Range total first; otherwise total = existing + remaining.
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

    // Open the .part file.
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

    // Make sure the destination directory exists.
    if let Some(parent) = std::path::Path::new(destination).parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }

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

    // Finished: flush, promote .part -> destination, emit completed.
    let _ = file.flush().await;
    let rename_result = tokio::fs::rename(&part_path, &destination).await;
    if let Err(e) = rename_result {
        // `rename` across some filesystems / when destination exists can fail;
        // fall back to removing the destination first.
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
        let _ = e; // original error superseded by retry result
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

/// Parse an HTTP `Content-Range` value of the form `bytes start-end/total`
/// (or `bytes */total`) and return the total size, if present.
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
