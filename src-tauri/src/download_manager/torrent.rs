use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::Emitter;
use librqbit::{Session, AddTorrent, AddTorrentOptions};
use std::time::Duration;

#[derive(Clone)]
pub struct TorrentDownloader {
    session: Arc<Mutex<Option<Arc<Session>>>>,
}

impl TorrentDownloader {
    pub fn new() -> Self {
        Self {
            session: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn start_torrent(
        &self,
        app_handle: tauri::AppHandle,
        task_id: String,
        magnet_link: String,
        dest_path: String,
    ) -> Result<(), String> {
        let mut session_lock = self.session.lock().await;

        let output_folder = std::path::Path::new(&dest_path).parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "C:\\Downloads".to_string());

        if session_lock.is_none() {
            let session = Session::new(output_folder.into()).await
                .map_err(|e| format!("Failed to create librqbit session: {}", e))?;
            *session_lock = Some(session);
        }
        
        let session = session_lock.as_ref().unwrap().clone();
        drop(session_lock); // Release lock early so other torrents can start

        let _ = app_handle.emit("download_progress", serde_json::json!({
            "taskId": task_id,
            "status": "downloading", // Starting DHT peering
            "totalBytes": 0,
            "downloadedBytes": 0,
            "speedBytesPerSec": 0
        }));

        tokio::spawn(async move {
            let add_req = AddTorrent::from_url(&magnet_link);

            let add_response = match session.add_torrent(add_req, Some(AddTorrentOptions::default())).await {
                Ok(resp) => resp,
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

            let handle = match add_response.into_handle() {
                Some(h) => h,
                None => {
                    // Already added or error
                    return;
                }
            };

            let wait_fut = handle.wait_until_completed();
            tokio::pin!(wait_fut);

            // Polling loop for live stats
            loop {
                tokio::select! {
                    _ = &mut wait_fut => {
                        let _ = app_handle.emit("download_progress", serde_json::json!({
                            "taskId": task_id,
                            "status": "completed",
                            "totalBytes": 1, // Hack to just trigger 100% completion in UI
                            "downloadedBytes": 1,
                            "speedBytesPerSec": 0
                        }));
                        break;
                    }
                    _ = tokio::time::sleep(Duration::from_millis(500)) => {
                        let _ = app_handle.emit("download_progress", serde_json::json!({
                            "taskId": task_id,
                            "status": "downloading",
                            "totalBytes": 100, // Placeholder
                            "downloadedBytes": 10, // Placeholder
                            "speedBytesPerSec": 500000 // Placeholder 500KB/s
                        }));
                    }
                }
            }
        });

        Ok(())
    }
}
