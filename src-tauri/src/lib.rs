pub mod download_manager;
pub mod database;
pub mod native_messaging;

use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::State;

use download_manager::http::HttpDownloader;
use download_manager::queue::QueueManager;

struct AppState {
    http_downloader: HttpDownloader,
    queue_manager: Arc<QueueManager>,
}

#[tauri::command]
async fn start_download(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    task_id: String,
    url: String,
    destination: String,
) -> Result<(), String> {
    // In a real implementation, we would spawn this to the QueueManager.
    // For now, we call the HTTP Downloader.
    state.http_downloader.start_download(app, task_id, url, destination).await
}

#[tauri::command]
async fn pause_download(
    state: State<'_, AppState>,
    task_id: String,
) -> Result<(), String> {
    state.queue_manager.pause_task(&task_id).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let http_downloader = HttpDownloader::new();
    let queue_manager = Arc::new(QueueManager::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            http_downloader,
            queue_manager,
        })
        .invoke_handler(tauri::generate_handler![start_download, pause_download])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
