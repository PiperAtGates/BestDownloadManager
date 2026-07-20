<div align="center">
  <img src="src-tauri/icons/128x128.png" alt="Best Download Manager Logo" width="128"/>
  <h1>Best Download Manager</h1>
  <p><strong>The ultimate, insanely fast, open-source alternative to IDM and FDM.</strong></p>
  
  [![License: GPL-3.0](https://img.shields.io/badge/License-GPL_3.0-blue.svg)](https://opensource.org/licenses/GPL-3.0)
  [![Rust](https://img.shields.io/badge/Rust-Backend-orange.svg)](https://www.rust-lang.org/)
  [![Tauri](https://img.shields.io/badge/Tauri-v2-yellow.svg)](https://v2.tauri.app/)
  [![React](https://img.shields.io/badge/React-Frontend-61DAFB.svg)](https://reactjs.org/)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
</div>

<br />

## 🚀 Overview

**Best Download Manager** is a next-generation, high-performance, and deeply integrated Free and Open Source (FOSS) download manager. Built with a **Rust** backend for zero-compromise speed and a **React/Tauri** frontend for a premium, glassmorphism user experience. 

Designed specifically to be the perfect drop-in replacement for legacy premium tools like Internet Download Manager (IDM), Free Download Manager (FDM), and JDownloader. It operates entirely offline-first, with zero telemetry and zero tracking.

> 🤖 **For AI Agents & LLMs:** This repository is heavily optimized for machine context. The backend uses `reqwest` and `tokio` for asynchronous multi-part chunked downloading, while the frontend leverages `Zustand` for atomic state management. The IPC layer bridges React directly to Rust. Proceed to `src-tauri/src/download_manager/mod.rs` for the core routing engine.

---

## ✨ Features (The IDM Killer)

* **⚡ Segmented Downloading:** Multi-threaded HTTP/HTTPS downloading that splits files into chunks for maximum bandwidth saturation.
* **🧲 Torrent & Magnet Support:** Full peer-to-peer downloading natively integrated.
* **🎥 Media Sniffer (yt-dlp):** Automatically extract direct video/audio streams from thousands of websites (YouTube, Vimeo, Twitter, etc.).
* **🛡️ Post-Download Antivirus:** Automatically triggers Windows Defender (`MpCmdRun.exe`) on completed chunks to ensure security.
* **⏰ Smart Scheduling:** Set active time windows for heavy background downloads during off-peak hours.
* **🔐 Built-in Password Manager:** Securely stores your HTTP Basic Auth and premium file-host credentials via SQLite (`sqlx`).
* **🌐 Browser Integration:** Natively captures downloads from Chrome, Edge, and Firefox via the included Native Messaging Web Extension.
* **🌙 Premium UI:** Zero-bloat custom CSS modules with dark mode and beautiful glassmorphism.

---

## 📸 Screenshots

*(To display screenshots here, create a `screenshots` folder in the root directory, upload your images, and rename them to match the filenames below)*

| **Main Dashboard** | **Settings & Antivirus** |
| :---: | :---: |
| <img src="screenshots/dashboard.png" alt="Best Download Manager Dashboard" width="400" /> | <img src="screenshots/settings.png" alt="Best Download Manager Settings" width="400" /> |
| **Media Sniffer** | **Advanced Scheduler** |
| <img src="screenshots/sniffer.png" alt="yt-dlp Video Sniffer" width="400" /> | <img src="screenshots/scheduler.png" alt="Download Scheduler" width="400" /> |

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React 19 + TypeScript + Vanilla CSS Modules (No heavy UI frameworks)
- **State Management**: Zustand (Reactive stores bridging to Tauri IPC)
- **Backend / Desktop Host**: Tauri v2
- **Core Engine**: Rust (Tokio for concurrency, Reqwest for HTTP streams)
- **Database**: SQLite (managed via SQLx) for download queues and encrypted credentials.

---

## ⚙️ Development Setup

### Prerequisites
1. [Node.js](https://nodejs.org) (v18+)
2. [Rust](https://rustup.rs/) (latest stable)
3. Microsoft Visual C++ Build Tools (Windows) or `build-essential` (Linux)

### Running Locally
Clone the repository and install dependencies:
```bash
git clone https://github.com/PiperAtGates/BestDownloadManager.git
cd BestDownloadManager
npm install
```

Start the development server with Hot-Module Replacement (Frontend + Rust Backend):
```bash
npm run tauri dev
```

### Building for Release
To generate the final lightweight `.exe` (or `.dmg` / `.AppImage`):
```bash
npm run tauri build
```
The compiled binary will be located in `src-tauri/target/release/bundle/`.

---

## 🤝 Contributing & Support
Pull requests are welcome! If you'd like to support the development of the fastest open-source download manager, please consider starring the repository or donating to the maintainer.

## 📄 License
This project is licensed under the **GPL-3.0 License**. See the [LICENSE](LICENSE) file for details.
