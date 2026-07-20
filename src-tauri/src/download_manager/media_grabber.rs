use std::process::Command;
use serde::Serialize;

#[derive(Serialize, Debug)]
pub struct MediaInfo {
    title: String,
    direct_url: String,
    ext: String,
}

pub struct MediaGrabber;

impl MediaGrabber {
    /// Invokes yt-dlp to extract the direct URL of a media stream
    pub fn sniff_media(url: &str) -> Result<MediaInfo, String> {
        // In a real production build, yt-dlp would be bundled via sidecar.
        // For now, we assume it's in the system PATH.
        let output = Command::new("yt-dlp")
            .args(&["--dump-json", "--no-playlist", url])
            .output()
            .map_err(|e| format!("Failed to execute yt-dlp: {}", e))?;

        if !output.status.success() {
            let err_msg = String::from_utf8_lossy(&output.stderr);
            return Err(format!("yt-dlp error: {}", err_msg));
        }

        let json_str = String::from_utf8_lossy(&output.stdout);
        let parsed: serde_json::Value = serde_json::from_str(&json_str)
            .map_err(|e| format!("Failed to parse yt-dlp JSON: {}", e))?;

        let title = parsed["title"].as_str().unwrap_or("unknown_video").to_string();
        let direct_url = parsed["url"].as_str().unwrap_or("").to_string();
        let ext = parsed["ext"].as_str().unwrap_or("mp4").to_string();

        if direct_url.is_empty() {
            return Err("Could not extract direct stream URL".to_string());
        }

        Ok(MediaInfo { title, direct_url, ext })
    }
}
