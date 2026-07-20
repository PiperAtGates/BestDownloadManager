pub mod http;
pub mod media_grabber;
pub mod queue;
pub mod security;
pub mod torrent;
pub mod youtube;

// This module acts as the entry point for the Vanguard download engine.

use tauri::Manager;

/// Resolve an external CLI tool (e.g. `yt-dlp`, `ffmpeg`) to a concrete path.
///
/// Preference order:
/// 1. A copy bundled as a Tauri resource at `<resource_dir>/binaries/<tool>.exe`
///    (this is how we ship yt-dlp/ffmpeg inside the installer, so end users
///    don't need anything on their PATH).
/// 2. A copy sitting next to the running executable (some install layouts).
/// 3. The bare tool name, resolved from PATH (used in `tauri dev` before the
///    binaries exist, and as a last resort).
///
/// Returns a string suitable for `tokio::process::Command::new`.
pub fn resolve_external(app: &tauri::AppHandle, base: &str) -> String {
    let exe_name = if cfg!(windows) {
        format!("{}.exe", base)
    } else {
        base.to_string()
    };

    // 1. Bundled in the app's resource directory.
    if let Ok(rd) = app.path().resource_dir() {
        let candidate = rd.join("binaries").join(&exe_name);
        if candidate.is_file() {
            return candidate.to_string_lossy().to_string();
        }
    }

    // 2. Next to the current executable (portable install / dev target dir).
    if let Ok(self_exe) = std::env::current_exe() {
        if let Some(dir) = self_exe.parent() {
            let candidate = dir.join(&exe_name);
            if candidate.is_file() {
                return candidate.to_string_lossy().to_string();
            }
        }
    }

    // 3. PATH fallback.
    base.to_string()
}

/// If a given tool is bundled, return the directory that contains it (for
/// passing to tools like yt-dlp's `--ffmpeg-location`). Returns `None` when the
/// tool is only available on PATH (no location override needed in that case).
pub fn bundled_tool_dir(app: &tauri::AppHandle, base: &str) -> Option<std::path::PathBuf> {
    let exe_name = if cfg!(windows) {
        format!("{}.exe", base)
    } else {
        base.to_string()
    };

    if let Ok(rd) = app.path().resource_dir() {
        let candidate = rd.join("binaries").join(&exe_name);
        if candidate.is_file() {
            return Some(rd.join("binaries"));
        }
    }
    if let Ok(self_exe) = std::env::current_exe() {
        if let Some(dir) = self_exe.parent() {
            let candidate = dir.join(&exe_name);
            if candidate.is_file() {
                return Some(dir.to_path_buf());
            }
        }
    }
    None
}
