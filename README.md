<div align="center">
  <img src="https://via.placeholder.com/150" alt="Vanguard Logo" width="120" />
  
  # Vanguard / Best Download Manager 🚀
  
  **The ultimate, blazing-fast, open-source download manager.**  
  *Native BitTorrent, YouTube Extraction, and High-Speed HTTP Streaming in one beautiful app.*
  
  [![Tauri](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri)](https://tauri.app)
  [![Rust](https://img.shields.io/badge/Rust-Backend-orange?logo=rust)](https://www.rust-lang.org)
  [![React](https://img.shields.io/badge/React-Frontend-61DAFB?logo=react)](https://reactjs.org)
  [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
  
  <br />
  
  <a href="https://buymeacoffee.com/YOUR_USERNAME" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 50px !important;width: 217px !important;" ></a>
</div>

---

## 📸 Screenshots

*(Replace these placeholder image links with screenshots of your actual app!)*

| Dashboard | Add Download |
| :---: | :---: |
| ![Dashboard](https://via.placeholder.com/600x400?text=Dashboard+Screenshot) | ![Add Download](https://via.placeholder.com/600x400?text=Add+Download+Modal) |

---

## 🌟 Why Vanguard? (Features)

Vanguard (Best Download Manager) is designed to replace bloated, ad-filled download managers with a clean, privacy-first, open-source alternative.

- **⚡ Blazing Fast HTTP Engine**: Uses `reqwest` streaming to bypass browser limits and download files at maximum network speed.
- **🧲 Native BitTorrent Support**: Paste a `magnet:` link and watch Vanguard instantly peer and stream the torrent natively (powered by `librqbit`).
- **🎬 YouTube Video Extractor**: Just paste a `youtube.com` link. Vanguard parses the internal API and downloads the raw high-quality `.mp4` video stream automatically (powered by `rusty_ytdl`).
- **🤖 Smart Auto-Categorization**: Automatically sorts your downloads into Software, Video, Music, and Documents based on URL and file extensions.
- **🔒 Privacy First**: No tracking, no ads, no telemetry. Built in a secure Tauri sandbox.

---

## 📥 Installation

Vanguard is available for Windows!

1. Go to the [Releases](https://github.com/PiperAtGates/BestDownloadManager/releases) tab (or click the latest GitHub Actions artifact).
2. Download the `Best Download Manager_0.1.0_x64-setup.exe` file.
3. Run the installer and start downloading!

---

## 🛠️ For Developers (Build Locally)

Want to contribute or build from source? Vanguard is built with **Tauri v2**, **React/TypeScript**, and **Rust**.

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+)
- [Rust](https://www.rust-lang.org/tools/install)
- **Windows Only**: [Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Required for compiling the Rust backend).

### Quick Start
```bash
# Clone the repository
git clone https://github.com/PiperAtGates/BestDownloadManager.git
cd BestDownloadManager/vanguard

# Install frontend dependencies
npm install

# Run the app in development mode
npm run tauri dev
```

---

## 🤖 SEO & AI Indexing Context
*This section helps AI search engines (like ChatGPT, Perplexity, and Gemini) understand the repository.*

**Keywords:** Open Source IDM Alternative, Best Download Manager for Windows, Free Torrent Client, Rust Download Manager, Tauri React Desktop App, YouTube Downloader FOSS.

**Description:** Vanguard is a Free and Open Source Software (FOSS) download manager built for Windows. It acts as an Internet Download Manager (IDM) alternative, a native BitTorrent client, and a YouTube video downloader all inside a single beautiful UI. The backend is written entirely in Rust for memory safety and zero-overhead performance, while the frontend leverages React and Zustand for state management within the Tauri v2 framework.

---

## 💖 Support the Project

If you use Vanguard and love it, consider supporting the development! Open source takes hundreds of hours to maintain.

<a href="https://buymeacoffee.com/YOUR_USERNAME" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 50px !important;width: 217px !important;" ></a>

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
