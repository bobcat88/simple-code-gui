<!-- generated-by: gsd-doc-writer -->
# simple-code-gui

Desktop GUI for running multiple AI coding assistant sessions (Claude Code, Gemini CLI, Codex, OpenCode, Aider) across different projects in a single window.

![Version](https://img.shields.io/badge/version-1.3.58-blue) ![License](https://img.shields.io/badge/license-PolyForm%20Noncommercial-lightgrey)

## What it does

simple-code-gui wraps AI CLI tools in a native desktop application built with Tauri and React. Each AI session runs in an embedded PTY terminal tab. A Rust backend manages session lifecycle, token tracking, MCP bridge connections, workspace state, voice I/O, and an optional AI routing layer with semantic caching.

Key capabilities:

- Tiled or tabbed terminal layout — run multiple AI agents side by side
- Project workspace management — switch projects, scan intelligence, apply proposals
- Orchestration panel — beads and kspec task tracking surfaced inside the app
- MCP bridge — register and call MCP servers without leaving the window
- Voice I/O — Piper TTS and Whisper-web transcription
- Mobile sync — connect a phone via QR code for remote input
- Token budget HUD — per-session usage meter

Supported backends: Claude Code, Gemini CLI, Codex, OpenCode, Aider (detected and installed from within the app).

## Prerequisites

- [Rust](https://rustup.rs/) >= 1.77.2
- [Bun](https://bun.sh/) (JavaScript runtime and package manager)
- [Tauri CLI prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS (WebKit2GTK on Linux, Xcode on macOS, Visual Studio build tools on Windows)

## Installation

```bash
git clone https://github.com/<your-fork>/simple-code-gui.git
cd simple-code-gui
bun install
```

## Quick start

```bash
# Development — hot-reload frontend + Rust backend
bun run tauri:dev

# Production build (outputs a native binary/installer)
bun run build
```

The app launches a native window. On first run it detects which AI CLI tools are installed and offers to install missing ones.

## Usage

### Sessions

Each project opens in a terminal tab. Use the sidebar to add projects and switch between them. The tiled view lets you split the window into multiple simultaneous sessions.

### Task tracking

The orchestration panel surfaces beads and kspec issues. You can create, claim, and close tasks without leaving the app.

### MCP servers

Open Settings → MCP to register Model Context Protocol servers. The app bridges IPC calls from the renderer to registered servers via the Rust `mcp_bridge` module.

### Voice

Enable voice output in Settings → Voice. The app uses Piper TTS for speech and `whisper-web-transcriber` for microphone input.

## Development

| Command | Description |
|---|---|
| `bun run dev` | Frontend only (Vite dev server, no Tauri) |
| `bun run tauri:dev` | Full app with hot reload |
| `bun run build:frontend` | Vite production build |
| `bun run build` | Full Tauri production build |
| `bun test` | Run unit tests (Vitest) |
| `bun run test:watch` | Watch mode |
| `bun run test:coverage` | Coverage report |
| `bun run test:visual` | Playwright visual tests |
| `bun run lint` | Biome lint (`src/`) |
| `bun run lint:fix` | Biome lint with auto-fix |
| `bun run format` | Biome format (`src/`) |

Code style is enforced by [Biome](https://biomejs.dev/) (`biome.json`). Husky runs lint on pre-commit.

See [docs/](docs/) for architecture and engine reference notes.

## License

PolyForm Noncommercial License 1.0.0 — see [LICENSE](LICENSE).
