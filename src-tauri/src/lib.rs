pub mod database;
pub mod download_manager;
pub mod native_messaging;

use std::collections::HashMap;
use std::sync::Arc;
use tauri::{Emitter, State};
use tokio_util::sync::CancellationToken;

use download_manager::http::HttpDownloader;
use download_manager::queue::QueueManager;
use download_manager::torrent::TorrentDownloader;
use download_manager::youtube::YoutubeDownloader;

struct AppState {
    http_downloader: HttpDownloader,
    torrent_downloader: TorrentDownloader,
    youtube_downloader: YoutubeDownloader,
    queue_manager: Arc<QueueManager>,
    cancel_map: Arc<tokio::sync::Mutex<HashMap<String, CancellationToken>>>,
}

#[tauri::command]
async fn start_download(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    task_id: String,
    url: String,
    destination: String,
) -> Result<(), String> {
    let token = CancellationToken::new();
    state
        .cancel_map
        .lock()
        .await
        .insert(task_id.clone(), token.clone());

    // A `.torrent` is only treated as a torrent when it's a local file on disk;
    // a remote URL ending in `.torrent` is downloaded as a file via HTTP.
    let is_local_torrent =
        url.ends_with(".torrent") && std::path::Path::new(&url).is_file();

    let result: Result<(), String> = if url.starts_with("magnet:") || is_local_torrent {
        state
            .torrent_downloader
            .start_torrent(app.clone(), task_id.clone(), url, destination, token)
            .await
    } else if url.contains("youtube.com") || url.contains("youtu.be") {
        state
            .youtube_downloader
            .start_download(app.clone(), task_id.clone(), url, destination, token)
            .await
    } else {
        state
            .http_downloader
            .start_download(app.clone(), task_id.clone(), url, destination, token)
            .await
    };

    if let Err(e) = result {
        state.cancel_map.lock().await.remove(&task_id);
        let _ = app.emit(
            "download_progress",
            serde_json::json!({
                "taskId": task_id,
                "status": "error",
                "errorMessage": e,
                "totalBytes": 0,
                "downloadedBytes": 0,
                "speedBytesPerSec": 0
            }),
        );
    }
    Ok(())
}

#[tauri::command]
async fn pause_download(
    state: State<'_, AppState>,
    _app: tauri::AppHandle,
    task_id: String,
) -> Result<(), String> {
    // Signal the running task to stop; it flushes its partial file and emits a
    // "paused" event itself.
    if let Some(token) = state.cancel_map.lock().await.remove(&task_id) {
        token.cancel();
    }
    // Also brief librqbit to pause piece fetching immediately.
    let _ = state.torrent_downloader.pause_torrent(&task_id).await;
    Ok(())
}

#[tauri::command]
async fn get_youtube_info(
    app: tauri::AppHandle,
    url: String,
) -> Result<String, String> {
    // Fetch the title via yt-dlp (matches the download engine, so the filename
    // previewed in Add Download matches what actually gets saved). Uses the
    // bundled binary when present, PATH otherwise.
    let yt_bin = download_manager::resolve_external(&app, "yt-dlp");
    let output = tokio::process::Command::new(&yt_bin)
        .args(["--no-playlist", "--print", "title", &url])
        .output()
        .await
        .map_err(|e| format!("Failed to spawn yt-dlp at \"{}\": {}", yt_bin, e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("yt-dlp failed: {}", stderr.trim()));
    }

    let title = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if title.is_empty() {
        Err("yt-dlp returned an empty title".to_string())
    } else {
        Ok(title)
    }
}

#[tauri::command]
async fn set_max_concurrent(state: State<'_, AppState>, n: usize) -> Result<(), String> {
    if n == 0 {
        return Err("Max concurrent downloads must be at least 1".to_string());
    }
    state.queue_manager.set_max(n);
    Ok(())
}

pub struct LogState {
    pub logs: Arc<tokio::sync::Mutex<Vec<String>>>,
}

#[tauri::command]
async fn get_logs(state: State<'_, LogState>) -> Result<Vec<String>, String> {
    let logs = state.logs.lock().await;
    Ok(logs.clone())
}

#[tauri::command]
fn set_default_torrent_client() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::*;
        use winreg::RegKey;

        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe_str = exe_path.to_str().unwrap_or("");

        let hkcu = RegKey::predef(HKEY_CURRENT_USER);

        let (torrent_key, _) = hkcu
            .create_subkey(r"Software\Classes\.torrent")
            .map_err(|e| e.to_string())?;
        torrent_key
            .set_value("", &"Vanguard.Torrent")
            .map_err(|e| e.to_string())?;

        let (vanguard_key, _) = hkcu
            .create_subkey(r"Software\Classes\Vanguard.Torrent\shell\open\command")
            .map_err(|e| e.to_string())?;
        vanguard_key
            .set_value("", &format!("\"{}\" \"%1\"", exe_str))
            .map_err(|e| e.to_string())?;

        let (magnet_key, _) = hkcu
            .create_subkey(r"Software\Classes\magnet")
            .map_err(|e| e.to_string())?;
        magnet_key
            .set_value("", &"URL:magnet")
            .map_err(|e| e.to_string())?;
        magnet_key
            .set_value("URL Protocol", &"")
            .map_err(|e| e.to_string())?;

        let (magnet_cmd, _) = hkcu
            .create_subkey(r"Software\Classes\magnet\shell\open\command")
            .map_err(|e| e.to_string())?;
        magnet_cmd
            .set_value("", &format!("\"{}\" \"%1\"", exe_str))
            .map_err(|e| e.to_string())?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        return Err("Setting the default torrent client is only supported on Windows.".into());
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let queue_manager = Arc::new(QueueManager::new(5));
    let permits = queue_manager.permits();

    let http_downloader = HttpDownloader::new(permits.clone());
    let torrent_downloader = TorrentDownloader::new(permits.clone());
    let youtube_downloader = YoutubeDownloader::new(permits.clone());
    let cancel_map = Arc::new(tokio::sync::Mutex::new(HashMap::new()));
    let logs = Arc::new(tokio::sync::Mutex::new(Vec::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            use tauri::Manager;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.center();
            }
            // Only start the Chrome native-messaging stdin listener when the app
            // was launched by the browser extension (which sets this env var),
            // so it never eats dev-console stdin.
            if std::env::var_os("VANGUARD_NATIVE_MESSAGING").is_some() {
                native_messaging::start_native_messaging_listener(app.handle().clone());
            }
            Ok(())
        })
        .manage(AppState {
            http_downloader,
            torrent_downloader,
            youtube_downloader,
            queue_manager,
            cancel_map,
        })
        .manage(LogState { logs })
        .invoke_handler(tauri::generate_handler![
            start_download,
            pause_download,
            get_youtube_info,
            get_logs,
            set_default_torrent_client,
            set_max_concurrent,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
