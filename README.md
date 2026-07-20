# Best Download Manager - FOSS Download Manager

Best Download Manager is a high-performance, modern, Free and Open Source download manager built with Tauri, Rust, and React. It is designed to rival premium download managers like IDM and FDM by offering maximum speed, minimal resource usage, and a beautiful, intuitive user interface.

## Features (In Development)
- Multi-threaded, segmented HTTP/HTTPS downloading for maximum speed
- Torrent and Magnet link support
- Clean, modern UI with dark mode and glassmorphism (React)
- Insanely small binary size and low RAM usage (Tauri + Rust)
- Queue management and bandwidth throttling
- Completely offline-first and telemetry-free

## Tech Stack
- **Frontend**: React 19 + TypeScript + Zustand + Vanilla CSS
- **Backend**: Tauri v2 + Rust
- **Download Engine**: Reqwest (HTTP), custom Tokio async queue
- **Database**: SQLite (planned)

## Development Setup

### Prerequisites
1. [Node.js](https://nodejs.org) (v18+)
2. [Rust](https://rustup.rs/) (latest stable)
3. Windows build tools (if on Windows) or `build-essential` (Linux)

### Running Locally
```bash
# Install dependencies
npm install

# Run development server (Frontend + Backend)
npm run tauri dev
```

### Building for Release
```bash
npm run tauri build
```
This will output a small executable in `src-tauri/target/release/bundle/`.

## License
Best Download Manager is open-sourced under the GPL-3.0 License.
