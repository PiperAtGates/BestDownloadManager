use rusty_ytdl::Video;
use tauri::Emitter;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use std::time::Instant;

#[derive(Clone)]
pub struct YoutubeDownloader {}

impl YoutubeDownloader {
    pub fn new() -> Self {
        Self {}
    }

    pub async fn start_download(
        &self,
        app_handle: tauri::AppHandle,
        task_id: String,
        url: String,
        destination: String,
    ) -> Result<(), String> {
        tokio::spawn(async move {
            let video = match Video::new(&url) {
                Ok(v) => v,
                Err(_) => {
                    let _ = app_handle.emit("download_progress", serde_json::json!({
                        "taskId": task_id,
                        "status": "error",
                        "totalBytes": 0,
                        "downloadedBytes": 0,
                        "speedBytesPerSec": 0
                    }));
                    return;
                }
            };

            let info = match video.get_info().await {
                Ok(i) => i,
                Err(_) => {
                    let _ = app_handle.emit("download_progress", serde_json::json!({
                        "taskId": task_id,
                        "status": "error",
                        "totalBytes": 0,
                        "downloadedBytes": 0,
                        "speedBytesPerSec": 0
                    }));
                    return;
                }
            };

            // Estimate total bytes (often rusty_ytdl doesn't know exact total before downloading unless formats are inspected, but we'll try to get it if available, or just set to 0 and calculate streaming speed)
            // For simplicity, we just set totalBytes = 0 if unknown, so the UI shows an indeterminate progress bar.
            // Let's see if we can get the contentLength of the highest quality video format.
            let mut total_bytes = 0;
            if let Some(format) = info.formats.first() {
                if let Some(ref cl) = format.content_length {
                    total_bytes = cl.parse::<u64>().unwrap_or(0);
                }
            }

            // Ensure destination directory exists
            if let Some(parent) = std::path::Path::new(&destination).parent() {
                let _ = tokio::fs::create_dir_all(parent).await;
            }

            // Let's make sure it saves as .mp4 by replacing whatever the default was
            let dest_path = if !destination.ends_with(".mp4") {
                format!("{}.mp4", destination)
            } else {
                destination
            };

            let mut file = match File::create(&dest_path).await {
                Ok(f) => f,
                Err(_) => {
                    let _ = app_handle.emit("download_progress", serde_json::json!({
                        "taskId": task_id,
                        "status": "error",
                        "totalBytes": total_bytes,
                        "downloadedBytes": 0,
                        "speedBytesPerSec": 0
                    }));
                    return;
                }
            };

            let stream = match video.stream().await {
                Ok(s) => s,
                Err(_) => {
                    let _ = app_handle.emit("download_progress", serde_json::json!({
                        "taskId": task_id,
                        "status": "error",
                        "totalBytes": total_bytes,
                        "downloadedBytes": 0,
                        "speedBytesPerSec": 0
                    }));
                    return;
                }
            };

            let mut downloaded_bytes: u64 = 0;
            let mut last_emit = Instant::now();
            let mut bytes_since_last_emit: u64 = 0;

            let _ = app_handle.emit("download_progress", serde_json::json!({
                "taskId": task_id,
                "status": "downloading",
                "totalBytes": total_bytes,
                "downloadedBytes": 0,
                "speedBytesPerSec": 0
            }));

            while let Some(chunk) = stream.chunk().await.unwrap_or(None) {
                if let Err(_) = file.write_all(&chunk).await {
                    let _ = app_handle.emit("download_progress", serde_json::json!({
                        "taskId": task_id,
                        "status": "error",
                        "totalBytes": total_bytes,
                        "downloadedBytes": downloaded_bytes,
                        "speedBytesPerSec": 0
                    }));
                    return;
                }

                let chunk_len = chunk.len() as u64;
                downloaded_bytes += chunk_len;
                bytes_since_last_emit += chunk_len;

                let now = Instant::now();
                let elapsed = now.duration_since(last_emit).as_millis();

                if elapsed >= 200 {
                    let speed = (bytes_since_last_emit as f64 / (elapsed as f64 / 1000.0)) as u64;

                    let _ = app_handle.emit("download_progress", serde_json::json!({
                        "taskId": task_id,
                        "status": "downloading",
                        "totalBytes": total_bytes,
                        "downloadedBytes": downloaded_bytes,
                        "speedBytesPerSec": speed
                    }));

                    last_emit = now;
                    bytes_since_last_emit = 0;
                }
            }

            let _ = app_handle.emit("download_progress", serde_json::json!({
                "taskId": task_id,
                "status": "completed",
                "totalBytes": if total_bytes == 0 { downloaded_bytes } else { total_bytes },
                "downloadedBytes": downloaded_bytes,
                "speedBytesPerSec": 0
            }));
        });

        Ok(())
    }
}
