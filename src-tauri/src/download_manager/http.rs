use reqwest::Client;
use tauri::Emitter;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use std::time::Instant;

#[derive(Clone)]
pub struct HttpDownloader {
    client: Client,
}

impl HttpDownloader {
    pub fn new() -> Self {
        let client = Client::builder()
            .danger_accept_invalid_certs(false)
            .user_agent("BestDownloadManager/1.0 (FOSS)")
            .build()
            .expect("Failed to build HTTP client");
            
        Self { client }
    }

    /// Starts a multi-threaded HTTP download (simplified for now to single thread stream)
    pub async fn start_download(
        &self, 
        app_handle: tauri::AppHandle, 
        task_id: String, 
        url: String, 
        destination: String
    ) -> Result<(), String> {
        let client = self.client.clone();

        // Spawn as a tokio task so we don't block the Tauri command handler
        tokio::spawn(async move {
            let res = match client.get(&url).send().await {
                Ok(r) => r,
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

            let total_bytes = res.headers()
                .get(reqwest::header::CONTENT_LENGTH)
                .and_then(|val| val.to_str().ok())
                .and_then(|val| val.parse::<u64>().ok())
                .unwrap_or(0);

            // Ensure destination directory exists (assuming it's just the C:\Downloads base for now)
            if let Some(parent) = std::path::Path::new(&destination).parent() {
                let _ = tokio::fs::create_dir_all(parent).await;
            }

            let mut file = match File::create(&destination).await {
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

            let mut downloaded_bytes: u64 = 0;
            let mut last_emit = Instant::now();
            let mut bytes_since_last_emit: u64 = 0;
            let mut res_mut = res; // Needs mut to pull chunks

            let _ = app_handle.emit("download_progress", serde_json::json!({
                "taskId": task_id,
                "status": "downloading",
                "totalBytes": total_bytes,
                "downloadedBytes": 0,
                "speedBytesPerSec": 0
            }));

            while let Ok(Some(chunk)) = res_mut.chunk().await {
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

                // Emit progress every ~200ms
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

            // Finished
            let _ = app_handle.emit("download_progress", serde_json::json!({
                "taskId": task_id,
                "status": "completed",
                "totalBytes": total_bytes,
                "downloadedBytes": total_bytes,
                "speedBytesPerSec": 0
            }));
        });

        Ok(())
    }
}
