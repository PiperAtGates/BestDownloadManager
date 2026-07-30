pub mod database;
pub mod download_manager;
pub mod native_messaging;

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{Emitter, State};
use tokio::sync::RwLock;
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
    /// Global download speed cap in bytes/sec. 0 = unlimited.
    speed_limit: Arc<RwLock<u64>>,
    /// Toggle for clipboard URL monitoring.
    clipboard_monitoring: Arc<AtomicBool>,
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

    let speed_limit = state.speed_limit.clone();

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
            .start_download(app.clone(), task_id.clone(), url, destination, token, speed_limit)
            .await
    } else {
        state
            .http_downloader
            .start_download(app.clone(), task_id.clone(), url, destination, token, speed_limit)
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
    if let Some(token) = state.cancel_map.lock().await.remove(&task_id) {
        token.cancel();
    }
    let _ = state.torrent_downloader.pause_torrent(&task_id).await;
    Ok(())
}

#[tauri::command]
async fn get_youtube_info(
    app: tauri::AppHandle,
    url: String,
) -> Result<String, String> {
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

#[tauri::command]
async fn set_speed_limit(state: State<'_, AppState>, bytes_per_sec: u64) -> Result<(), String> {
    *state.speed_limit.write().await = bytes_per_sec;
    Ok(())
}

#[tauri::command]
async fn set_clipboard_monitoring(
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<(), String> {
    state.clipboard_monitoring.store(enabled, Ordering::Relaxed);
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

/// Spawn a background task that polls the clipboard every 1.5 seconds and emits
/// `clipboard_url_detected` when a new URL-like value is copied.
fn start_clipboard_monitor(app: tauri::AppHandle, enabled: Arc<AtomicBool>) {
    std::thread::spawn(move || {
        let mut clipboard = match arboard::Clipboard::new() {
            Ok(c) => c,
            Err(e) => {
                eprintln!("[Clipboard Monitor] Failed to open clipboard: {}", e);
                return;
            }
        };
        let mut last_seen = String::new();

        loop {
            std::thread::sleep(std::time::Duration::from_millis(1500));

            if !enabled.load(Ordering::Relaxed) {
                last_seen.clear();
                continue;
            }

            let text = match clipboard.get_text() {
                Ok(t) => t,
                Err(_) => continue,
            };

            let trimmed = text.trim().to_string();
            if trimmed == last_seen || trimmed.is_empty() {
                continue;
            }

            // Only emit for URL-like content
            let is_url = trimmed.starts_with("http://")
                || trimmed.starts_with("https://")
                || trimmed.starts_with("ftp://")
                || trimmed.starts_with("magnet:");

            if is_url {
                last_seen = trimmed.clone();
                let _ = app.emit(
                    "clipboard_url_detected",
                    serde_json::json!({ "url": trimmed }),
                );
            } else {
                // Still advance last_seen so we don't re-detect the same non-URL text
                last_seen = trimmed;
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let queue_manager = Arc::new(QueueManager::new(5));
    let permits = queue_manager.permits();
    let speed_limit = Arc::new(RwLock::new(0u64));
    let clipboard_monitoring = Arc::new(AtomicBool::new(false));

    let http_downloader = HttpDownloader::new(permits.clone(), speed_limit.clone());
    let torrent_downloader = TorrentDownloader::new(permits.clone());
    let youtube_downloader = YoutubeDownloader::new(permits.clone(), speed_limit.clone());
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
            if std::env::var_os("VANGUARD_NATIVE_MESSAGING").is_some() {
                native_messaging::start_native_messaging_listener(app.handle().clone());
            }
            // Start clipboard monitor (disabled by default; frontend toggles it)
            let clip_enabled = app
                .state::<AppState>()
                .clipboard_monitoring
                .clone();
            start_clipboard_monitor(app.handle().clone(), clip_enabled);
            Ok(())
        })
        .manage(AppState {
            http_downloader,
            torrent_downloader,
            youtube_downloader,
            queue_manager,
            cancel_map,
            speed_limit,
            clipboard_monitoring,
        })
        .manage(LogState { logs })
        .invoke_handler(tauri::generate_handler![
            start_download,
            pause_download,
            get_youtube_info,
            get_logs,
            set_default_torrent_client,
            set_max_concurrent,
            set_speed_limit,
            set_clipboard_monitoring,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
