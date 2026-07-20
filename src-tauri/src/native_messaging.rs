use std::io::{self, Read, Write};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Deserialize, Serialize, Clone, Debug)]
struct IncomingMessage {
    action: String,
    url: String,
    filename: String,
    referrer: Option<String>,
}

#[derive(Serialize)]
struct OutgoingMessage {
    status: String,
    message: String,
}

/// Start a background thread listening to stdin for Chrome Native Messaging
pub fn start_native_messaging_listener(app: AppHandle) {
    std::thread::spawn(move || {
        loop {
            // Chrome sends the message length as a 4-byte native-endian integer
            let mut len_bytes = [0u8; 4];
            if io::stdin().read_exact(&mut len_bytes).is_err() {
                break; // Stdin closed
            }

            let len = u32::from_ne_bytes(len_bytes) as usize;
            let mut msg_bytes = vec![0u8; len];
            if io::stdin().read_exact(&mut msg_bytes).is_err() {
                break;
            }

            if let Ok(msg_str) = String::from_utf8(msg_bytes) {
                if let Ok(msg) = serde_json::from_str::<IncomingMessage>(&msg_str) {
                    if msg.action == "add_download" {
                        // Forward to React frontend
                        let _ = app.emit("browser_download_intercepted", msg);
                        
                        // Send success response back to Chrome
                        send_response(OutgoingMessage {
                            status: "success".into(),
                            message: "Added to Best Download Manager queue".into(),
                        });
                    }
                }
            }
        }
    });
}

fn send_response(msg: OutgoingMessage) {
    if let Ok(json) = serde_json::to_string(&msg) {
        let len = json.len() as u32;
        let mut stdout = io::stdout();
        let _ = stdout.write_all(&len.to_ne_bytes());
        let _ = stdout.write_all(json.as_bytes());
        let _ = stdout.flush();
    }
}
