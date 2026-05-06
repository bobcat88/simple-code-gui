<!-- generated-by: gsd-doc-writer -->
# Development Guide

This guide covers local development setup, build commands, code style conventions, the Tauri IPC architecture, and how to add new backend commands.

---

## Local Setup

### Prerequisites

- **Rust** (stable toolchain, minimum `1.77.2` per `Cargo.toml`)
- **Bun** (JavaScript runtime and package manager — used instead of npm/yarn)
- **Tauri CLI** — installed via the `devDependencies` in `package.json` (`@tauri-apps/cli 2.10.1`)
- System libraries required by Tauri on Linux: `libwebkit2gtk`, `libgtk-3`, `libayatana-appindicator` (see [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/))

### Install and configure

```bash
git clone <repo-url>
cd simple-code-gui
bun install
```

Copy the environment example if one exists and fill in any required API keys:

```bash
cp .env.example .env   # if present
```

AI provider keys can also be set as environment variables at runtime — the Rust backend reads `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `DEEPSEEK_API_KEY`, and `DEEPSEEK_BASE_URL` on startup and registers them automatically.

---

## Build Commands

All commands are run from the project root with `bun run`.

| Command | What it does |
|---|---|
| `bun run dev` | Vite dev server only (frontend, port 1420) — no Rust backend |
| `bun run tauri:dev` | Full Tauri development build — compiles Rust, launches desktop window |
| `bun run build:frontend` | Vite production build of the React frontend to `dist/` |
| `bun run build` | Full Tauri production build — frontend + Rust, produces a native binary |
| `bun run preview` | Serve the `dist/` directory locally via Vite |
| `bun run test` | Run Vitest once (no watch) |
| `bun run test:watch` | Run Vitest in watch mode |
| `bun run test:coverage` | Vitest with V8 coverage report |
| `bun run coverage:touched` | Coverage gate for files touched in the current diff |
| `bun run test:visual` | Playwright visual smoke tests |
| `bun run lint` | Biome check on `src/` (read-only) |
| `bun run lint:fix` | Biome check with auto-fix |
| `bun run format` | Biome formatter with auto-fix |

> **Note:** `bun run tauri:dev` is the standard way to run the full app locally. It launches the Vite dev server internally, then opens the Tauri window with hot-reload on the frontend. Rust changes require a full recompile.

---

## Code Style

### Frontend — Biome

The project uses **Biome** (`@biomejs/biome 2.4.14`) for both linting and formatting. Configuration lives in `biome.json` at the project root.

Key settings:
- Indent: 2 spaces
- Quote style: single quotes
- Trailing commas: ES5 style
- `noExplicitAny`: warn (not error)
- Import organization: automatic (on save / `lint:fix`)
- Scope: `src/**` only — `src-tauri/`, `dist/`, `node_modules/` are excluded

Run the linter:

```bash
bun run lint        # check only
bun run lint:fix    # apply safe fixes
bun run format      # format only
```

CI runs `bunx biome check src/` as a non-blocking step (`continue-on-error: true`) to track lint debt without failing the pipeline.

### Backend — Clippy

Rust code is checked with Clippy in CI:

```bash
cd src-tauri && cargo clippy -- -D warnings
```

All Clippy warnings are treated as errors in CI.

### Pre-commit Hook

Husky runs a pre-commit hook (`.husky/pre-commit`) that executes:

```bash
bunx tsc --noEmit && bunx vitest run --reporter=dot
```

Both TypeScript type-checking and the full Vitest suite must pass before a commit is accepted.

---

## Project Structure

```
simple-code-gui/
├── src/
│   └── renderer/           # React frontend (TypeScript)
│       ├── App/            # Root app components and layouts
│       ├── api/            # API abstraction layer (Tauri + HTTP backends)
│       ├── components/     # Feature-grouped UI components
│       ├── contexts/       # React contexts
│       ├── hooks/          # Custom hooks
│       ├── lib/            # Low-level Tauri IPC wrapper (tauri-ipc.ts)
│       ├── stores/         # Zustand state stores
│       ├── styles/         # Global CSS
│       ├── themes/         # Theme definitions
│       └── utils/          # Shared utilities
├── src-tauri/
│   └── src/                # Rust backend
│       ├── lib.rs          # Entry point, Tauri builder, all command registrations
│       ├── pty_manager.rs  # PTY session lifecycle
│       ├── session_manager.rs
│       ├── settings_manager.rs
│       ├── workspace_manager.rs
│       ├── orchestration.rs    # Beads / kspec orchestration commands
│       ├── mcp_bridge.rs       # MCP server integration
│       ├── ai_runtime/         # AI provider abstraction
│       ├── database.rs         # SQLite via sqlx
│       └── ...                 # Other manager modules
├── biome.json              # Biome lint + format config
├── vite.config.ts          # Vite build config (port 1420)
├── vitest.config.ts        # Vitest test config
└── package.json            # Scripts, dependencies
```

---

## Tauri IPC Architecture

The app has two transport modes selected at runtime:

- **Tauri mode** (desktop): `TauriBackend` class, backed by `tauriIpc` which calls `invoke()` from `@tauri-apps/api/core`
- **HTTP mode** (remote / browser): `HttpBackend` class, communicates over HTTP + WebSocket

Both backends implement the same `Api` / `ExtendedApi` interface (`src/renderer/api/types.ts`). The correct backend is selected in `src/renderer/api/index.ts`:

```typescript
export function initializeApi(config?: { host: string; port: number; token: string }): Api {
  if (isTauriEnvironment()) {
    apiInstance = new TauriBackend()
  } else if (config) {
    apiInstance = new HttpBackend(config)
  } else {
    throw new Error('Running in unknown environment. Tauri or HTTP config required.')
  }
  return apiInstance
}
```

### IPC call flow

```
React component
  → tauriIpc.someMethod()         (src/renderer/lib/tauri-ipc.ts)
    → invoke('command_name', …)   (@tauri-apps/api/core)
      → #[tauri::command] fn      (src-tauri/src/lib.rs or manager module)
```

Events flow in the opposite direction:

```
Rust: app.emit("pty-data-{id}", data)
  → listen("pty-data-{id}", handler)   (tauriIpc.onPtyData)
    → PtyDataCallback in React
```

The low-level IPC wrapper is `src/renderer/lib/tauri-ipc.ts`. It is the single place that calls `invoke()` and `listen()`. `TauriBackend` (in `src/renderer/api/tauri-backend.ts`) delegates to it and maps the results to the `ExtendedApi` interface.

---

## Adding a New Tauri Command

### 1. Write the Rust command

Add a function to the appropriate module in `src-tauri/src/`, or directly in `lib.rs` for simple commands:

```rust
// src-tauri/src/lib.rs (or a dedicated manager file)
#[tauri::command]
async fn my_new_command(
    state: State<'_, Arc<SomeManager>>,
    arg_one: String,
    arg_two: Option<u32>,
) -> Result<String, String> {
    // implementation
    Ok("result".to_string())
}
```

- Use `State<'_, Arc<T>>` to access managed singletons.
- Return `Result<T, String>` — the error string is forwarded to the frontend.
- Struct fields serialized across the boundary must derive `Serialize` and `Deserialize` with `#[serde(rename_all = "camelCase")]` to match TypeScript conventions.

### 2. Register the command

Add the function to the `tauri::generate_handler![]` macro call in `lib.rs` (around line 645):

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    my_new_command,
])
```

### 3. Add the TypeScript wrapper to `tauriIpc`

Extend `src/renderer/lib/tauri-ipc.ts`:

```typescript
myNewCommand: (argOne: string, argTwo?: number) =>
  invoke<string>('my_new_command', { arg_one: argOne, arg_two: argTwo }),
```

> Note the naming convention: Rust uses `snake_case` for parameter names; the `invoke` call must pass an object with `snake_case` keys matching the Rust function signature.

### 4. Expose through `TauriBackend` (if part of the public API)

If the command needs to be callable through the `Api` / `ExtendedApi` interface, add a method to `TauriBackend` in `src/renderer/api/tauri-backend.ts`:

```typescript
async myNewCommand(argOne: string, argTwo?: number): Promise<string> {
  return tauriIpc.myNewCommand(argOne, argTwo);
}
```

And add the corresponding method signature to the interface in `src/renderer/api/types.ts`.

---

## Frontend Patterns

### State management

Global state uses **Zustand** stores in `src/renderer/stores/`. The main workspace store is `src/renderer/stores/workspace.ts`. Use the `useWorkspaceStore` hook to access it in components.

### Data fetching

Server state (settings, workspace data) is fetched via **TanStack Query** (`@tanstack/react-query`). Custom hooks in `src/renderer/hooks/` wrap query logic — for example, `useSettings.ts`, `useWorkspaceLoader.ts`, `useSessionPolling.ts`.

### Component organization

Components are grouped by feature in `src/renderer/components/`:

| Directory | Purpose |
|---|---|
| `terminal/` | xterm.js terminal panels |
| `orchestration/` | Beads / kspec orchestration UI |
| `intelligence/` | Project intelligence and vector search |
| `settings/` | Settings modal and panels |
| `sidebar/` | Project and session sidebar |
| `agents/` | Agent board and task management |
| `mcp/` | MCP server configuration |
| `voice/` | Voice transcription overlay |
| `gsd/` | GSD engine integration |
| `tiled/` | Tiled window layout |

### Contexts

Key React contexts are in `src/renderer/contexts/`:
- `DialogContext` — dialog management
- `ModalContext` — modal state (`useModals` hook)
- `VoiceContext` — voice/TTS state (`useVoice` hook)

---

## Branch Conventions

No formal branch naming convention is documented in the repository. The default and main branch is `main`. CI runs on push to `main` and on pull requests targeting `main`.

---

## PR Process

1. Create a branch from `main` and make your changes.
2. Ensure the pre-commit hook passes: TypeScript type-check and full Vitest suite.
3. Open a pull request against `main`. CI runs:
   - TypeScript type check (`bunx tsc --noEmit`)
   - Vitest coverage (must meet thresholds — see `vitest.config.ts`)
   - Touched-folder coverage gate (`bun run coverage:touched`)
   - Biome lint (non-blocking, logged as debt)
   - Playwright visual smoke tests
   - Frontend build
   - Cargo check + Clippy (Rust, `-D warnings`)
4. Coverage results are posted as a PR comment via `vitest-coverage-report-action`.
5. All CI jobs must pass before merge.

---

## Next Steps

- **Testing**: see `docs/testing/overview.md` for coverage thresholds and test patterns.
- **Configuration**: see `docs/guides/configuration.md` for environment variables and settings.
- **Architecture**: see `docs/architecture/overview.md` for the system design.
