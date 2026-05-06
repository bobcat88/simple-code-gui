<!-- generated-by: gsd-doc-writer -->
# Architecture Overview

## System Overview

simple-code-gui is a desktop application that provides a unified graphical interface for managing multiple AI coding assistant sessions simultaneously. It accepts user input through xterm.js terminal panes and routes it to AI CLI backends (Claude Code, Gemini CLI, Codex, OpenCode, or Aider) running as real OS processes via pseudo-terminals (PTY). The frontend is a React/TypeScript single-page application rendered inside a Tauri 2 WebView; the backend is a Rust process that owns PTY lifecycle, workspace/settings persistence, AI provider routing, vector indexing, and orchestration tooling. A secondary HTTP connection mode allows browser or Capacitor (mobile) clients to connect to a running desktop instance over the local network.

## Component Diagram

```mermaid
graph TD
    subgraph Frontend["Frontend (React/TypeScript)"]
        AC[AppConnection] --> MA[MainApp]
        MA --> SL[SidebarLayout]
        MA --> TL[TerminalLayout]
        MA --> IL[IntelligenceLayout]
        TL --> TERM[Terminal / xterm.js]
        SL --> WS[Workspace Store / Zustand]
        MA --> HOOKS[Hooks Layer]
        HOOKS --> API[Api Interface]
    end

    subgraph IPC["IPC Boundary"]
        API -->|Tauri invoke| CMD[Tauri Commands]
        API -->|Tauri events| EVT[Tauri Events]
        API -->|HTTP fallback| HTTP[HTTP Backend]
    end

    subgraph Backend["Backend (Rust / Tauri)"]
        CMD --> PTY[PtyManager]
        CMD --> SESS[SessionManager]
        CMD --> SET[SettingsManager]
        CMD --> WKS[WorkspaceManager]
        CMD --> DB[DatabaseManager / SQLite]
        CMD --> AIR[AI RuntimeManager]
        CMD --> GSD[GsdEngine]
        CMD --> ORC[OrchestrationState]
        CMD --> VEC[VectorEngine]
        CMD --> MCP[McpBridge]
        CMD --> VOI[VoiceManager]
        CMD --> MOB[MobileSync]

        PTY -->|pty-data-{id} event| EVT
        AIR --> PROV[AI Providers]
        PROV --> CLAUDE[ClaudeProvider]
        PROV --> GEMINI[GeminiProvider]
        PROV --> OAI[OpenAIProvider]
        PROV --> DS[DeepSeekProvider]
        PROV --> OLL[OllamaProvider]
    end

    subgraph ExternalCLIs["External CLI Processes"]
        PTY --> CCODE[claude code]
        PTY --> GCLI[gemini]
        PTY --> CODEX[codex]
        PTY --> OPC[opencode]
        PTY --> AIDER[aider]
    end
```

## Data Flow

A typical session from project open to terminal output follows these steps:

1. **Project selection** — The user clicks a project in the sidebar. The `useProjectHandlers` hook calls `api.spawnPty(cwd, backend)`.
2. **IPC call** — The `TauriBackend` class wraps the call via `tauriIpc.spawnSession`, which invokes the Tauri command `spawn_session` in Rust.
3. **PTY spawn** — `PtyManager` uses `portable_pty` to launch the selected CLI binary (`claude code`, `gemini`, etc.) as a child process inside a PTY, and assigns a UUID to the session.
4. **Output streaming** — A background thread reads PTY output and emits Tauri events named `pty-data-{id}`. The frontend `Terminal` component listens via `api.onPtyData` and writes bytes directly to the xterm.js instance.
5. **User input** — Keystrokes from xterm.js call `api.writePty`, which invokes `write_to_pty` on the Rust side, writing bytes into the PTY master.
6. **Session end** — The CLI process exits; `PtyManager`'s watchdog emits `pty-dead-{id}`. The frontend removes the tab.
7. **Workspace persistence** — On every tab/project state change, `MainApp` calls `api.saveWorkspace`, persisting state to SQLite via `WorkspaceManager`.

## Key Abstractions

| Abstraction | Location | Description |
|-------------|----------|-------------|
| `Api` / `ExtendedApi` | `src/renderer/api/api-interface.ts` | Frontend-facing interface covering all backend operations; `TauriBackend` and `HttpBackend` implement it |
| `TauriBackend` | `src/renderer/api/tauri-backend.ts` | Desktop implementation of `Api` — delegates to `tauriIpc` typed wrappers |
| `tauriIpc` | `src/renderer/lib/tauri-ipc.ts` | Typed `invoke`/`listen` wrappers at the Tauri IPC boundary |
| `PtyManager` | `src-tauri/src/pty_manager.rs` | Owns all live PTY sessions; wraps `portable_pty`; emits Tauri events for output/exit/title/path |
| `RuntimeManager` | `src-tauri/src/ai_runtime/mod.rs` | Multi-provider AI routing layer with health tracking, optimizer pipeline, and semantic cache |
| `AIProvider` (trait) | `src-tauri/src/ai_runtime/mod.rs` | Implemented by Claude, Gemini, OpenAI, DeepSeek, Ollama providers for completion/embedding |
| `GsdEngine` | `src-tauri/src/gsd_engine/mod.rs` | Workflow execution engine — plans, phases, steps, swarm governance, distributed discovery |
| `VectorEngine` | `src-tauri/src/vector_engine/mod.rs` | In-process vector store backed by SQLite; indexes project knowledge and session summaries |
| `OrchestrationState` | `src-tauri/src/orchestration.rs` | Shared state for beads/kspec task tracking, approval workflows, and swarm snapshots |
| `WorkspaceStore` | `src/renderer/stores/workspace.ts` | Zustand store for projects, open tabs, categories, and active tab — source of truth for UI |
| `BackendId` | `src/renderer/api/terminal-types.ts` | Union type `'claude' \| 'gemini' \| 'codex' \| 'opencode' \| 'aider'` identifying the active CLI |
| `McpBridge` | `src-tauri/src/mcp_bridge.rs` | MCP (Model Context Protocol) server registry with health monitoring and remote tool execution |

## Directory Structure Rationale

### Frontend (`src/`)

```
src/
├── constants.ts              # App-wide constants (non-renderer)
├── global.d.ts               # Global TypeScript declarations
├── test-setup.ts             # Vitest global test setup
└── renderer/
    ├── App/                  # Top-level app shell components (AppConnection, MainApp, layouts)
    ├── api/                  # Api interface, two backend implementations, and all API types
    ├── components/           # UI components organized by feature area
    │   ├── beads/            # Beads/kspec task tracker UI
    │   ├── intelligence/     # Intelligence sidebar (vector search, brainstorm, cognitive hub)
    │   ├── mobile/           # Mobile-specific views (Capacitor/HTTP connection mode)
    │   ├── orchestration/    # Multi-agent orchestration panels and swarm graph
    │   ├── settings/         # Settings modal sections
    │   ├── sidebar/          # Project sidebar with virtualized list and session switcher
    │   ├── telemetry/        # Cost, health, and job HUDs
    │   ├── terminal/         # xterm.js terminal component and associated hooks
    │   ├── tiled/            # Tile-layout engine for split-pane terminal views
    │   ├── voice/            # TTS transcription overlay
    │   └── gsd/              # GSD workflow UI (NeuralHUD, forensics, permission guard)
    ├── contexts/             # React contexts: Api, Dialog, Modal, Voice
    ├── hooks/                # Custom React hooks extracted from MainApp
    ├── lib/                  # Low-level utilities: tauri-ipc typed wrappers, LRU cache
    ├── stores/               # Zustand stores: workspace, jobs
    └── themes/               # Theme definitions, CSS variable application, terminal themes
```

### Backend (`src-tauri/src/`)

```
src-tauri/src/
├── lib.rs                    # Tauri builder, command registration, manager initialization
├── main.rs                   # Binary entry point (calls lib::run)
├── pty_manager.rs            # PTY lifecycle, backend switching, output buffering
├── session_manager.rs        # Claude/Gemini session file discovery on disk
├── settings_manager.rs       # Typed settings persistence to SQLite
├── workspace_manager.rs      # Workspace (projects + tabs) persistence to SQLite
├── database.rs               # SQLite schema, token event logging, query helpers
├── orchestration.rs          # Beads, kspec, approval workflow, swarm snapshot commands
├── mcp_bridge.rs             # MCP server registry and health monitor
├── voice_manager.rs          # Piper/XTTS TTS synthesis
├── mobile_sync.rs            # Local IP discovery for mobile HTTP connection (port 4747)
├── platform.rs               # OS detection helpers
├── ai_runtime/               # Multi-provider AI runtime
│   ├── mod.rs                # RuntimeManager, provider routing, health tracking
│   ├── providers/            # Claude, Gemini, OpenAI, DeepSeek, Ollama implementations
│   ├── optimizer/            # Token optimization pipeline and middlewares
│   ├── semantic_cache.rs     # Embedding-based response caching
│   ├── context_compressor.rs # Context window compression
│   └── learning.rs           # Autonomous learning / evolution loop
├── gsd_engine/               # GSD workflow engine
│   ├── mod.rs                # Plan/phase/step execution, Tauri commands
│   ├── executor.rs           # Step executor
│   ├── governance.rs         # Swarm policy enforcement
│   ├── sync.rs               # Memory sync to Borg vault
│   ├── distributed.rs        # Distributed node discovery and credit system
│   └── knowledge.rs          # Knowledge base operations
├── vector_engine/            # In-process vector store
│   ├── mod.rs                # Index/search API
│   ├── indexer.rs            # Chunking and embedding pipeline
│   └── types.rs              # VectorChunk, VectorSearchResult, VectorIndexStatus
├── agent_manager.rs          # Agent registration, metrics, task queues, traces
├── activity_manager.rs       # Activity feed and log
├── health_manager.rs         # System health checks and panic hook
├── jobs_manager.rs           # Background job queue with progress events
├── diagnostic_manager.rs     # Diagnostic bundle generation
├── extension_manager.rs      # Skill/MCP extension registry
├── upgrade_manager.rs        # Dependency upgrade analysis and rollback
├── rtk_manager.rs            # RTK token savings telemetry
├── rtk_context.rs            # RTK context optimization (assimilation)
└── nexus_context.rs          # GitNexus context pruning helper
```

## Deployment Topology

The application ships as a single Tauri desktop binary embedding the React WebView. There is no separate server process required for standard use. The optional HTTP mode (`mobile_sync`) starts an embedded HTTP server on port 4747 so that browser or Capacitor mobile clients can connect to the same backend over the LAN using a one-time token for authentication. <!-- VERIFY: exact port and HTTP server implementation details — the mobile_sync module exposes connection info but the HTTP server start/stop path is managed separately -->
