# Vanguard / Best Download Manager

A Windows download manager that handles HTTP downloads, BitTorrent magnet links, and YouTube videos. Ships with yt-dlp bundled — no extra setup needed.

[![Build](https://github.com/PiperAtGates/BestDownloadManager/actions/workflows/build.yml/badge.svg)](https://github.com/PiperAtGates/BestDownloadManager/actions/workflows/build.yml)
[![Tauri](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri)](https://tauri.app)
[![Rust](https://img.shields.io/badge/Rust-Backend-orange?logo=rust)](https://www.rust-lang.org)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## Features

- **HTTP downloads** — multi-threaded, resume support
- **BitTorrent** — magnet link support via librqbit
- **YouTube** — video downloads via built-in yt-dlp (install [ffmpeg](https://ffmpeg.org/) on PATH for best-quality merge)
- **Download queue** — pause, resume, cancel, prioritize
- **Scheduler** — set downloads to run at specific times
- **Browser extension companion** — basic native messaging support
- **Dark theme** — clean UI built with React + Zustand

## Downloads

Grab the latest installer from the [Releases page](https://github.com/PiperAtGates/BestDownloadManager/releases). The installer includes yt-dlp and ffmpeg — everything works out of the box.

## Build from source

**Prerequisites:** Node.js 20+, Rust, Visual Studio C++ Build Tools (Windows).

```bash
npm install
npm run tauri dev     # development mode
npm run tauri build   # production build
```

## Tech stack

Frontend: React, TypeScript, Zustand, Vite  
Backend: Rust, Tauri v2  
Downloads: reqwest (HTTP), librqbit (BitTorrent), yt-dlp (YouTube)

## License

MIT
