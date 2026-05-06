<!-- generated-by: gsd-doc-writer -->
# Getting Started

This guide takes you from zero to a running simple-code-gui desktop app. It covers prerequisites, installation, first launch, common setup problems, and where to go next.

---

## Prerequisites

You need the following tools installed before building or running the app.

### Runtime requirements

| Tool | Minimum version | Notes |
|---|---|---|
| [Rust](https://rustup.rs/) | `>= 1.77.2` | Install via `rustup`. Required for the Tauri backend. |
| [Bun](https://bun.sh/) | latest stable | JavaScript runtime and package manager used by this project. |
| [Node.js](https://nodejs.org/) | >= 18 | Required by some build tooling; Bun ships a compatible runtime automatically. |

### System dependencies (Linux)

Tauri requires a WebKit-based webview and build utilities. On Debian/Ubuntu:

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf \
  build-essential \
  curl \
  wget
```

Refer to the [Tauri v2 prerequisites guide](https://v2.tauri.app/start/prerequisites/) for Arch, Fedora, and other distributions.

### macOS / Windows

On macOS, Xcode Command Line Tools are required (`xcode-select --install`). On Windows, install the [Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) and enable the WebView2 runtime (bundled with Windows 11; installer available for Windows 10).

---

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/bobcat88/simple-code-gui.git
cd simple-code-gui
```

### 2. Install frontend dependencies

```bash
bun install
```

### 3. Install the Rust toolchain (first time only)

```bash
rustup update stable
```

Cargo will download backend crate dependencies automatically on the first build.

---

## First Run

Start the app in development mode (hot-reload frontend + Tauri shell):

```bash
bun run tauri:dev
```

This runs `vite` for the frontend (served at `http://localhost:1420`) and launches the native Tauri window automatically. Changes to `src/` files reload the UI without restarting the process.

To start the frontend dev server alone (no native window):

```bash
bun run dev
```

---

## Common Setup Issues

### Rust compilation fails with missing system libraries

Tauri links against system WebKit and GTK libraries. If `cargo` errors with `pkg-config` or missing `.so` files, install the Linux system dependencies listed in the Prerequisites section above.

### `bun install` hangs or fails on lockfile mismatch

The project ships `bun.lock`. If you have an older Bun version, upgrade it:

```bash
bun upgrade
```

Then re-run `bun install --frozen-lockfile`.

### Port 1420 already in use

The Vite dev server defaults to port `1420` (set in `src-tauri/tauri.conf.json`). Stop any other process using that port, or temporarily change `devUrl` in `src-tauri/tauri.conf.json` and `server.port` in `vite.config.ts` to an unused port.

### Tauri window does not open but Vite starts successfully

The Tauri CLI (`@tauri-apps/cli`) must be installed locally via `bun install`. If `tauri` is not found, confirm it is present in `node_modules/.bin/tauri` and run through Bun:

```bash
bunx tauri dev
```

### API keys are missing on first launch

No `.env` file is required. API keys (Anthropic, Google, OpenAI, DeepSeek) can be set as environment variables before launch to seed the database, or added in-app via the AI Providers settings panel. See [Configuration](./configuration.md) for the full variable list.

---

## Next Steps

- **[Configuration](./configuration.md)** — Environment variables, in-app settings, and provider setup.
- **[Architecture](../architecture/overview.md)** — How the Rust backend, IPC layer, and React frontend fit together.
