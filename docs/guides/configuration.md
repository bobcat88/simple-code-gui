<!-- generated-by: gsd-doc-writer -->
# Configuration

This document covers all configuration surfaces for simple-code-gui: environment variables used at startup, the in-app settings persisted to the SQLite database, the Tauri window/bundle configuration, and Vite/Biome tooling settings.

---

## Environment Variables

The backend reads environment variables at startup to seed AI provider API keys and optional distributed-mode settings. No `.env` file is required — variables are optional unless noted.

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Optional | — | Seeds the Claude provider on first launch. If absent, configure the key in-app via the AI Providers settings panel. |
| `GOOGLE_API_KEY` | Optional | — | Seeds the Gemini provider on first launch. |
| `OPENAI_API_KEY` | Optional | — | Seeds the OpenAI/Codex provider on first launch. |
| `OPENAI_BASE_URL` | Optional | — | Override the OpenAI-compatible base URL (e.g., for a local proxy). Used together with `OPENAI_API_KEY`. |
| `DEEPSEEK_API_KEY` | Optional | — | Seeds the DeepSeek provider on first launch. |
| `DEEPSEEK_BASE_URL` | Optional | `https://api.deepseek.com` | Override the DeepSeek API endpoint. |
| `GSD_REDIS_URL` | Optional | `redis://127.0.0.1/` | Redis URL for distributed swarm discovery. Falls back to `REDIS_URL`. Only needed for multi-node setups. |
| `REDIS_URL` | Optional | `redis://127.0.0.1/` | Fallback Redis URL when `GSD_REDIS_URL` is not set. |
| `GSD_NODE_NAME` | Optional | `nexus-<random-8-chars>` | Node name used in distributed swarm mode. Defaults to a random UUID prefix. |

API keys set via environment variables are registered as providers at startup. They do not override keys that are already stored in the database — they act as a bootstrap for a fresh install.

---

## In-App Settings (AppSettings)

Settings are persisted in a SQLite database at the platform's application config directory. The database file is `app.db`; the settings row is stored under the `app_settings` key in the `settings` table.

**Config directory locations by platform:**
- Linux: `~/.config/com.simplecode.gui/`
- macOS: `~/Library/Application Support/com.simplecode.gui/`
- Windows: `%APPDATA%\com.simplecode.gui\`

> Settings previously stored in `settings.json` in the same directory are migrated automatically on first launch and the old file is renamed to `settings.json.bak`.

### General Settings

| Field | Default | Description |
|---|---|---|
| `defaultProjectDir` | `""` | Default directory used when opening a new project. Set this to your workspace root. |
| `theme` | `"default"` | UI theme name. |
| `permissionMode` | `"default"` | Controls which shell/tool actions require confirmation from the user. |
| `autoAcceptTools` | `[]` | List of tool names that are auto-accepted without a prompt. |
| `backend` | `"default"` | Active AI coding backend (e.g., `claude`, `opencode`). |
| `accentColor` | `"#3b82f6"` | Hex color used as the UI accent. |
| `glowEnabled` | `true` | Enables the glow visual effect on session cards. |
| `autoScanEnabled` | `true` | Enables automatic project directory scanning. |
| `autoScanInterval` | `3600` | Scan interval in seconds (default: 1 hour). |

### Text-to-Speech Settings

| Field | Default | Description |
|---|---|---|
| `ttsEngine` | `"piper"` | TTS engine. `"piper"` uses the local Piper binary; `"xtts"` uses the XTTS HTTP server. |
| `ttsVoice` | `"en_US-libritts_r-medium"` | Voice model ID for the Piper engine. |
| `ttsSpeed` | `1.0` | Playback speed multiplier (Piper engine). |
| `tadaVoiceSample` | `"v2/en_3"` | Voice sample used for the completion sound. |
| `xttsTemperature` | `0.7` | Temperature for XTTS generation (higher = more expressive). |
| `xttsTopK` | `50` | Top-K sampling for XTTS. |
| `xttsTopP` | `0.8` | Top-P (nucleus) sampling for XTTS. |
| `xttsRepetitionPenalty` | `2.0` | Repetition penalty for XTTS. |

Piper voice model files (`.onnx` + `.onnx.json`) are stored in `<app-config-dir>/voices/`. The Piper binary is expected at `<app-config-dir>/bin/piper/piper` (Linux/macOS) or `<app-config-dir>/bin/piper/piper.exe` (Windows).

### AI Runtime Settings

The `aiRuntime` block controls multi-provider AI routing.

#### Providers

Each provider has the following shape:

```json
{
  "id": "claude",
  "name": "Anthropic Claude",
  "enabled": true,
  "apiKey": null,
  "baseUrl": null,
  "models": ["claude-3-5-sonnet", "claude-3-opus", "claude-3-haiku"],
  "defaultModel": "claude-3-5-sonnet"
}
```

Built-in providers and their default state:

| Provider ID | Name | Enabled by default | Default base URL |
|---|---|---|---|
| `claude` | Anthropic Claude | Yes | — (uses SDK default) |
| `gemini` | Google Gemini | Yes | — (uses SDK default) |
| `openai` | OpenAI / Codex | No | — (uses SDK default) |
| `deepseek` | DeepSeek | No | `https://api.deepseek.com` |
| `ollama` | Local Ollama | No | `http://localhost:11434` |

#### Model Plans

Plans define which model handles each agent role. Three plans are built in:

| Plan ID | Description | Planner | Builder | Reviewer | Researcher |
|---|---|---|---|---|---|
| `balanced` | Optimal mix of speed and intelligence | claude-3-5-sonnet | claude-3-5-sonnet | claude-3-5-sonnet | gemini-1.5-flash |
| `budget` | Lowest cost, suitable for simple tasks | claude-3-haiku | claude-3-haiku | claude-3-haiku | gemini-1.5-flash |
| `robust` | Maximum reasoning for critical projects | claude-3-opus | claude-3-5-sonnet | claude-3-opus | gemini-1.5-pro |

#### Routing Policy and Strategy

| Field | Default | Values | Description |
|---|---|---|---|
| `activePlanId` | `"balanced"` | `balanced`, `budget`, `robust` | The plan used for all agent roles by default. |
| `defaultStrategy` | `"quality"` | `quality`, `cheap`, `latency`, `auto` | Strategy hint for the runtime dispatcher. |

Individual roles can override the active plan via `routing` entries with `planId`, `modelOverride`, or `providerOverride`.

---

## Tauri Configuration (`src-tauri/tauri.conf.json`)

| Field | Value | Description |
|---|---|---|
| `productName` | `simple-code-gui` | Application bundle name. |
| `identifier` | `com.simplecode.gui` | Reverse-DNS app identifier (also used as config directory name). |
| `build.devUrl` | `http://localhost:1420` | URL Tauri connects to during `tauri dev`. |
| `build.beforeDevCommand` | `bun run dev` | Vite dev server start command. |
| `build.beforeBuildCommand` | `bun run build:frontend` | Frontend build command before packaging. |
| `app.windows[0].title` | `Codex One` | Initial window title. |
| `app.windows[0].width` | `1000` | Initial window width in pixels. |
| `app.windows[0].height` | `700` | Initial window height in pixels. |
| `app.windows[0].decorations` | `false` | Native window decorations are disabled (custom titlebar). |
| `bundle.targets` | `["deb"]` | Bundle formats produced by `bun run build`. |

### Updater Plugin

| Field | Value |
|---|---|
| `plugins.updater.active` | `true` |
| `plugins.updater.endpoints` | `https://github.com/bobcat88/simple-code-gui/releases/latest/download/latest.json` <!-- VERIFY: confirm this is the correct update endpoint for production releases --> |
| `plugins.updater.dialog` | `false` (update UI is handled in-app) |

The updater public key in `tauri.conf.json` must be replaced with the real signing key before publishing a release. The placeholder value `dW51c2VkX3B1YmtleV9mb3JfZGV2ZWxvcG1lbnRfcmVwbGFjZV9tZQ==` is a development stand-in.

### Capabilities (`src-tauri/capabilities/default.json`)

The default capability set granted to the main window:

- `core:default`
- `shell:default`
- `dialog:default`
- `notification:default`
- `fs:default`
- `os:default`
- `global-shortcut:default`

### Global Keyboard Shortcut

`Alt+Space` is registered at startup to toggle the main window's visibility.

---

## Vite Configuration (`vite.config.ts`)

| Field | Value | Description |
|---|---|---|
| `server.port` | `1420` | Dev server port (must match `build.devUrl` in `tauri.conf.json`). |
| `server.strictPort` | `true` | Fails if port 1420 is unavailable. |
| `build.chunkSizeWarningLimit` | `500` (KB) | Suppress warnings below this bundle chunk size. |

The Tauri source directory (`src-tauri/`) is excluded from Vite's file watcher to avoid unnecessary rebuilds.

---

## Biome Configuration (`biome.json`)

Biome handles both linting and formatting for all TypeScript/TSX source files under `src/`.

| Setting | Value |
|---|---|
| Indent style | Spaces |
| Indent width | 2 |
| Quote style | Single quotes |
| Trailing commas | ES5 |
| Import organization | Automatic (on save) |

Run linting and formatting:

```bash
bun run lint        # Check src/ with Biome
bun run lint:fix    # Auto-fix violations
bun run format      # Format src/ in place
```

---

## Workspace and Project Data

Project list and categories are persisted in the same `app.db` SQLite database (tables: `projects`, `categories`). A legacy `workspace.json` migration runs automatically on first launch if the file exists and the database is empty — the old file is then renamed to `workspace.json.bak`.

---

## Per-Environment Notes

There is no multi-environment config file mechanism (no `.env.development` / `.env.production`). Environment-specific values are controlled entirely through:

1. Shell environment variables set before launching the app.
2. In-app settings UI (persisted to SQLite).
3. `tauri.conf.json` for bundle-time values (updater endpoint, window config).
