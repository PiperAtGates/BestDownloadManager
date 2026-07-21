pub mod download_manager;
pub mod database;
pub mod native_messaging;

use std::sync::Arc;
use tauri::State;

use download_manager::http::HttpDownloader;
use download_manager::queue::QueueManager;
use download_manager::torrent::TorrentDownloader;
use download_manager::youtube::YoutubeDownloader;
use std::collections::HashMap;

struct AppState {
    http_downloader: HttpDownloader,
    torrent_downloader: TorrentDownloader,
    youtube_downloader: YoutubeDownloader,
    queue_manager: Arc<QueueManager>,
    cancel_map: Arc<tokio::sync::Mutex<HashMap<String, tokio::task::JoinHandle<()>>>>,
}

#[tauri::command]
async fn start_download(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    task_id: String,
    url: String,
    destination: String,
) -> Result<(), String> {
    let handle = if url.starts_with("magnet:") || url.ends_with(".torrent") {
        state.torrent_downloader.start_torrent(app, task_id.clone(), url, destination).await?
    } else if url.contains("youtube.com") || url.contains("youtu.be") {
        state.youtube_downloader.start_download(app, task_id.clone(), url, destination).await?
    } else {
        state.http_downloader.start_download(app, task_id.clone(), url, destination).await?
    };

    state.cancel_map.lock().await.insert(task_id, handle);
    Ok(())
}

#[tauri::command]
async fn pause_download(state: State<'_, AppState>, _app: tauri::AppHandle, task_id: String) -> Result<(), String> {
    if let Some(handle) = state.cancel_map.lock().await.remove(&task_id) {
        handle.abort();
    }
    Ok(())
}

#[tauri::command]
async fn get_youtube_info(url: String) -> Result<String, String> {
    use rusty_ytdl::Video;
    let video = Video::new(&url).map_err(|e| format!("Invalid URL: {}", e))?;
    let info = video.get_info().await.map_err(|e| format!("Failed to fetch info: {}", e))?;
    Ok(info.video_details.title)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let http_downloader = HttpDownloader::new();
    let torrent_downloader = TorrentDownloader::new();
    let youtube_downloader = YoutubeDownloader::new();
    let queue_manager = Arc::new(QueueManager::new());
    let cancel_map = Arc::new(tokio::sync::Mutex::new(HashMap::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            http_downloader,
            torrent_downloader,
            youtube_downloader,
            queue_manager,
            cancel_map,
        })
        .invoke_handler(tauri::generate_handler![start_download, pause_download, get_youtube_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
