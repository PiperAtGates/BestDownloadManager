use librqbit::{AddTorrent, AddTorrentOptions, Session};
use std::sync::Arc;
use std::time::Duration;
use tauri::Emitter;
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use super::queue::Permits;

use std::collections::HashMap;

#[derive(Clone)]
pub struct TorrentDownloader {
    session: Arc<Mutex<Option<Arc<Session>>>>,
    handles: Arc<Mutex<HashMap<String, Arc<librqbit::ManagedTorrent>>>>,
    permits: Permits,
}

impl TorrentDownloader {
    pub fn new(permits: Permits) -> Self {
        Self {
            session: Arc::new(Mutex::new(None)),
            handles: Arc::new(Mutex::new(HashMap::new())),
            permits,
        }
    }

    pub async fn start_torrent(
        &self,
        app_handle: tauri::AppHandle,
        task_id: String,
        magnet_link: String,
        dest_path: String,
        token: CancellationToken,
    ) -> Result<(), String> {
        let session_store = self.session.clone();
        let handles_clone = self.handles.clone();
        let sem = self.permits.read().unwrap().clone();

        tokio::spawn(async move {
            // Count against the concurrency limit while we peer/seed.
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

            let output_folder = std::path::Path::new(&dest_path)
                .parent()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| "C:\\Downloads".to_string());

            let _ = tokio::fs::create_dir_all(&output_folder).await;

            // Lazily create the shared librqbit session.
            let session = {
                let mut session_lock = session_store.lock().await;
                if session_lock.is_none() {
                    match Session::new(output_folder.clone().into()).await {
                        Ok(s) => *session_lock = Some(s),
                        Err(e) => {
                            let _ = app_handle.emit(
                                "download_progress",
                                serde_json::json!({
                                    "taskId": task_id,
                                    "status": "error",
                                    "errorMessage": format!("Failed to create librqbit session: {}", e),
                                    "totalBytes": 0,
                                    "downloadedBytes": 0,
                                    "speedBytesPerSec": 0
                                }),
                            );
                            return;
                        }
                    }
                }
                session_lock.as_ref().unwrap().clone()
            };

            let add_req = if magnet_link.ends_with(".torrent") {
                match tokio::fs::read(&magnet_link).await {
                    Ok(bytes) => AddTorrent::from_bytes(bytes),
                    Err(e) => {
                        let _ = app_handle.emit(
                            "download_progress",
                            serde_json::json!({
                                "taskId": task_id,
                                "status": "error",
                                "errorMessage": format!("Failed to read .torrent file: {}", e),
                                "totalBytes": 0,
                                "downloadedBytes": 0,
                                "speedBytesPerSec": 0
                            }),
                        );
                        return;
                    }
                }
            } else {
                AddTorrent::from_url(&magnet_link)
            };

            let add_response = match session
                .add_torrent(
                    add_req,
                    Some(AddTorrentOptions {
                        overwrite: true,
                        output_folder: Some(output_folder.into()),
                        ..Default::default()
                    }),
                )
                .await
            {
                Ok(resp) => resp,
                Err(e) => {
                    let _ = app_handle.emit(
                        "download_progress",
                        serde_json::json!({
                            "taskId": task_id,
                            "status": "error",
                            "errorMessage": format!("Failed to add torrent: {}", e),
                            "totalBytes": 0,
                            "downloadedBytes": 0,
                            "speedBytesPerSec": 0
                        }),
                    );
                    return;
                }
            };

            let handle = match add_response.into_handle() {
                Some(h) => h,
                None => return, // already added or in error state
            };

            let wait_fut = handle.wait_until_completed();
            tokio::pin!(wait_fut);

            let mut last_progress = 0u64;
            let mut last_emit = std::time::Instant::now();

            let tid = task_id.clone();
            handles_clone.lock().await.insert(tid.clone(), handle.clone());

            loop {
                tokio::select! {
                    _ = &mut wait_fut => {
                        handles_clone.lock().await.remove(&tid);
                        let stats = handle.stats();
                        let name = handle.name().unwrap_or_else(|| "completed_torrent".to_string());
                        let total = if stats.total_bytes == 0 { stats.progress_bytes } else { stats.total_bytes };
                        let _ = app_handle.emit("download_progress", serde_json::json!({
                            "taskId": task_id,
                            "status": "completed",
                            "filename": name,
                            "totalBytes": total,
                            "downloadedBytes": stats.progress_bytes,
                            "speedBytesPerSec": 0
                        }));
                        break;
                    }
                    _ = token.cancelled() => {
                        handles_clone.lock().await.remove(&tid);
                        if let Some(live) = handle.live() {
                            let _ = live.pause();
                        }
                        let stats = handle.stats();
                        let name = handle.name().unwrap_or_else(|| "unknown".to_string());
                        let total = if stats.total_bytes == 0 { stats.progress_bytes } else { stats.total_bytes };
                        let _ = app_handle.emit("download_progress", serde_json::json!({
                            "taskId": task_id,
                            "status": "paused",
                            "filename": name,
                            "totalBytes": total,
                            "downloadedBytes": stats.progress_bytes,
                            "speedBytesPerSec": 0
                        }));
                        break;
                    }
                    _ = tokio::time::sleep(Duration::from_millis(500)) => {
                        let stats = handle.stats();
                        let now = std::time::Instant::now();
                        let elapsed = now.duration_since(last_emit).as_secs_f64();

                        let speed = if elapsed > 0.0 && stats.progress_bytes >= last_progress {
                            ((stats.progress_bytes - last_progress) as f64 / elapsed) as u64
                        } else {
                            0
                        };

                        let name = handle.name().unwrap_or_else(|| "unknown".to_string());
                        let total = if stats.total_bytes == 0 { stats.progress_bytes } else { stats.total_bytes };

                        let _ = app_handle.emit("download_progress", serde_json::json!({
                            "taskId": task_id,
                            "status": "downloading",
                            "filename": name,
                            "totalBytes": total,
                            "downloadedBytes": stats.progress_bytes,
                            "speedBytesPerSec": speed
                        }));

                        last_progress = stats.progress_bytes;
                        last_emit = now;
                    }
                }
            }
        });

        Ok(())
    }

    pub async fn pause_torrent(&self, task_id: &str) -> Result<(), String> {
        if let Some(handle) = self.handles.lock().await.remove(task_id) {
            if let Some(live) = handle.live() {
                let _ = live.pause();
            }
        }
        Ok(())
    }
}
