//! YouTube backend powered by the `yt-dlp` command-line tool.
//!
//! The previous in-process `rusty_ytdl` implementation broke repeatedly against
//! YouTube's evolving player/signature checks (errors like "Video source empty"
//! / 403s). `yt-dlp` is actively maintained and handles those, so we shell out
//! to it here and stream its progress into the same `download_progress` events
//! every other downloader emits.
//!
//! Requires `yt-dlp` on PATH (the same tool `media_grabber` already assumes).
//! Muxing bestvideo+bestaudio also needs `ffmpeg` on PATH; if it's absent yt-dlp
//! falls back to a pre-merged single stream, so downloads still work.
use std::process::Stdio;
use std::sync::Arc;
use std::time::Instant;
use tauri::{Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;

use super::queue::Permits;

#[derive(Clone)]
pub struct YoutubeDownloader {
    permits: Permits,
    speed_limit: Arc<RwLock<u64>>,
}

impl YoutubeDownloader {
    pub fn new(permits: Permits, speed_limit: Arc<RwLock<u64>>) -> Self {
        Self { permits, speed_limit }
    }

    pub async fn start_download(
        &self,
        app_handle: tauri::AppHandle,
        task_id: String,
        url: String,
        destination: String,
        token: CancellationToken,
        speed_limit: Arc<RwLock<u64>>,
    ) -> Result<(), String> {
        let sem = self.permits.read().unwrap().clone();

        tokio::spawn(async move {
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

            run_download(&app_handle, task_id, url, destination, token, speed_limit).await;
        });

        Ok(())
    }
}

fn file_basename(path: &str) -> String {
    std::path::Path::new(path)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default()
}

fn log(app: &tauri::AppHandle, msg: String) {
    eprintln!("[YouTube Downloader] {}", msg);
    if let Some(log_state) = app.try_state::<crate::LogState>() {
        if let Ok(mut logs) = log_state.logs.try_lock() {
            logs.push(format!("[YouTube Downloader] {}", msg));
        }
    }
}

fn emit_error(app: &tauri::AppHandle, task_id: &str, message: &str, total_bytes: u64) {
    let _ = app.emit(
        "download_progress",
        serde_json::json!({
            "taskId": task_id,
            "status": "error",
            "errorMessage": message,
            "totalBytes": total_bytes,
            "downloadedBytes": 0,
            "speedBytesPerSec": 0
        }),
    );
}

fn parse_u64(v: &str) -> Option<u64> {
    if v == "NA" || v.is_empty() {
        None
    } else {
        v.parse::<u64>().ok()
    }
}

fn parse_f64(v: &str) -> Option<f64> {
    if v == "NA" || v.is_empty() {
        None
    } else {
        v.parse::<f64>().ok()
    }
}

/// Strip a trailing `.mp4` (the default the frontend assumes) so yt-dlp can pick
/// the real extension itself via `%(ext)s`.
fn strip_mp4_ext(path: &str) -> String {
    if let Some(stem) = path.strip_suffix(".mp4") {
        stem.to_string()
    } else {
        path.to_string()
    }
}

/// After a successful run, fall back to scanning the destination directory for
/// the produced file if yt-dlp didn't print its final path.
async fn guess_saved_basename(outbase: &str) -> String {
    let path = std::path::Path::new(outbase);
    let name = match path.file_name().and_then(|s| s.to_str()) {
        Some(n) => n.to_string(),
        None => return "video.mp4".to_string(),
    };
    let prefix = format!("{}.", name);

    if let Some(parent) = path.parent() {
        if let Ok(mut rd) = tokio::fs::read_dir(parent).await {
            while let Ok(Some(entry)) = rd.next_entry().await {
                if let Some(fname) = entry.file_name().to_str() {
                    if let Some(rest) = fname.strip_prefix(&prefix) {
                        if !rest.is_empty()
                            && !rest.ends_with(".part")
                            && !rest.ends_with(".temp")
                            && !rest.ends_with(".ytdl")
                        {
                            return fname.to_string();
                        }
                    }
                }
            }
        }
    }
    format!("{}.mp4", name)
}

async fn run_download(
    app: &tauri::AppHandle,
    task_id: String,
    url: String,
    destination: String,
    token: CancellationToken,
    speed_limit: Arc<RwLock<u64>>,
) {
    let outbase = strip_mp4_ext(&destination); // e.g. C:\Downloads\My Video

    if let Some(parent) = std::path::Path::new(&outbase).parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }

    log(app, format!("Starting yt-dlp for {}", url));

    let output_template = format!("{}.%(ext)s", outbase);
    let progress_template =
        "download:DL:D=%(progress.downloaded_bytes)s|T=%(progress.total_bytes)s|E=%(progress.total_bytes_estimate)s|S=%(progress.speed)s";

    // Resolve yt-dlp by path: prefer the copy bundled inside the app (so end
    // users need nothing on their PATH), fall back to PATH for `tauri dev`.
    let yt_bin = super::resolve_external(app, "yt-dlp");

    let mut args: Vec<String> = vec![
        "--no-playlist".into(),
        "--newline".into(),
        "-f".into(),
        "bestvideo*+bestaudio/best".into(),
        "--merge-output-format".into(),
        "mp4".into(),
        "-o".into(),
        output_template.clone(),
        "--progress-template".into(),
        progress_template.to_string(),
        "--print".into(),
        "after_move:filepath".into(),
    ];

    // Tell yt-dlp where the bundled ffmpeg lives so high-quality merges work
    // even when ffmpeg isn't installed system-wide.
    if let Some(dir) = super::bundled_tool_dir(app, "ffmpeg") {
        args.push("--ffmpeg-location".into());
        args.push(dir.to_string_lossy().to_string());
    }

    // Apply the global speed cap if set (yt-dlp's --limit-rate uses K/M/G suffixes)
    let limit_bps = *speed_limit.read().await;
    if limit_bps > 0 {
        let rate_str = if limit_bps >= 1024 * 1024 {
            format!("{}M", limit_bps / (1024 * 1024))
        } else {
            format!("{}K", limit_bps / 1024)
        };
        args.push("--limit-rate".into());
        args.push(rate_str);
    }

    args.push(url.clone());

    let mut child = match Command::new(&yt_bin)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(c) => c,
        Err(e) => {
            let m = format!(
                "Failed to spawn yt-dlp at \"{}\" — bundled it? install it on PATH? ({})",
                yt_bin, e
            );
            log(app, m.clone());
            emit_error(app, &task_id, &m, 0);
            return;
        }
    };

    let stdout = child.stdout.take().expect("piped stdout");
    let stderr = child.stderr.take().expect("piped stderr");
    let mut stderr_lines = BufReader::new(stderr).lines();
    let mut stdout_lines = BufReader::new(stdout).lines();

    let _ = app.emit(
        "download_progress",
        serde_json::json!({
            "taskId": task_id,
            "status": "downloading",
            "totalBytes": 0,
            "downloadedBytes": 0,
            "speedBytesPerSec": 0
        }),
    );

    let mut last_emit = Instant::now();
    let mut downloaded: u64 = 0;
    let mut total: u64 = 0;
    let mut last_error: Option<String> = None;

    // Stream yt-dlp's stderr (progress + errors) while it runs, and let the
    // cancel token kill the child immediately if the user pauses.
    loop {
        tokio::select! {
            biased;
            _ = token.cancelled() => {
                let _ = child.kill().await;
                let _ = child.wait().await;
                let _ = app.emit(
                    "download_progress",
                    serde_json::json!({
                        "taskId": task_id,
                        "status": "paused",
                        "totalBytes": total,
                        "downloadedBytes": downloaded,
                        "speedBytesPerSec": 0
                    }),
                );
                return;
            }
            line = stderr_lines.next_line() => {
                match line {
                    Ok(Some(l)) => {
                        // yt-dlp prints progress using our template, possibly
                        // prefixed with the key ("download:"). Find our
                        // sentinel anywhere on the line so the prefix doesn't
                        // matter.
                        if let Some(idx) = l.find("DL:D=") {
                            let rest = &l[idx + "DL:D=".len()..];
                            let mut d = None;
                            let mut t = None;
                            let mut e = None;
                            let mut s = None;
                            for seg in rest.split('|') {
                                if let Some(v) = seg.strip_prefix("D=") { d = parse_u64(v); }
                                else if let Some(v) = seg.strip_prefix("T=") { t = parse_u64(v); }
                                else if let Some(v) = seg.strip_prefix("E=") { e = parse_u64(v); }
                                else if let Some(v) = seg.strip_prefix("S=") { s = parse_f64(v); }
                            }
                            if let Some(dd) = d { downloaded = dd; }
                            total = t.or(e).unwrap_or(total);

                            let now = Instant::now();
                            if now.duration_since(last_emit).as_millis() >= 200 {
                                let _ = app.emit(
                                    "download_progress",
                                    serde_json::json!({
                                        "taskId": task_id,
                                        "status": "downloading",
                                        "totalBytes": total,
                                        "downloadedBytes": downloaded,
                                        "speedBytesPerSec": s.map(|v| v as u64).unwrap_or(0)
                                    }),
                                );
                                last_emit = now;
                            }
                        } else if l.starts_with("ERROR:") {
                            last_error = Some(l.clone());
                        }
                    }
                    Ok(None) => break,
                    Err(_) => break,
                }
            }
        }
    }

    // stderr closed = yt-dlp finished writing. Drain stdout for the final path.
    let mut final_path: Option<String> = None;
    while let Ok(Some(l)) = stdout_lines.next_line().await {
        if !l.is_empty() {
            final_path = Some(l);
        }
    }

    match child.wait().await {
        Ok(status) if status.success() => {
            let fname = match final_path {
                Some(p) => file_basename(&p),
                None => guess_saved_basename(&outbase).await,
            };
            let _ = app.emit(
                "download_progress",
                serde_json::json!({
                    "taskId": task_id,
                    "filename": fname,
                    "status": "completed",
                    "totalBytes": if total == 0 { downloaded } else { total },
                    "downloadedBytes": downloaded,
                    "speedBytesPerSec": 0
                }),
            );
        }
        Ok(status) => {
            let m = last_error
                .unwrap_or_else(|| format!("yt-dlp exited with code {:?}", status.code()));
            log(app, m.clone());
            emit_error(app, &task_id, &m, total);
        }
        Err(e) => {
            let m = format!("Failed to wait for yt-dlp: {}", e);
            log(app, m.clone());
            emit_error(app, &task_id, &m, total);
        }
    }
}
