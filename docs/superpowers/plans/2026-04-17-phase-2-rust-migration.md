# Phase 2: Core Rust Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Electron main process to Rust using Tauri, providing significant performance gains and a more robust foundation for terminal orchestration.

**Architecture:** Initialize Tauri as the new application framework. Re-implement the `PtyManager` in Rust using `portable-pty` and expose it via Tauri commands. Migrate Electron IPC handlers to Rust Command handlers.

**Tech Stack:** Rust, Tauri v2, portable-pty, serde, tokio.

---

### Task 1: Tauri Initial Setup

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/src/main.rs`
- Modify: `package.json`

- [ ] **Step 1: Initialize Tauri project**
Run: `bunx tauri init` (Select defaults, but point to `../dist` for frontend and `bun run dev` for dev server).

- [ ] **Step 2: Configure tauri.conf.json for Electron-like behavior**
Update `tauri.conf.json` to enable necessary features (shell, dialog, fs) and set window dimensions consistent with the current UI.

- [ ] **Step 3: Add dependencies to Cargo.toml**
Add `portable-pty`, `serde`, `serde_json`, and `tokio`.

- [ ] **Step 4: Update package.json scripts**
Add `tauri` scripts: `"tauri": "tauri"`.

- [ ] **Step 5: Commit**
```bash
git add src-tauri package.json
git commit -m "feat(rust): initialize tauri project"
```

### Task 2: Core PTY Manager (Rust)

**Files:**
- Create: `src-tauri/src/pty_manager.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Define PtyManager struct and Session types**
Implement the basic structure to track PTY processes and their output buffers in Rust.

- [ ] **Step 2: Implement find_executable logic**
Port the backend-specific executable discovery logic (Claude, Gemini, etc.) from `pty-manager.ts` to Rust.

- [ ] **Step 3: Implement spawn_pty with portable-pty**
Implement the core spawning logic, handling environment variables (PATH) and terminal dimensions.

- [ ] **Step 4: Implement OutputBuffer with line-stripping**
Port the ANSI-stripping and ring-buffer logic to Rust.

- [ ] **Step 5: Implement debounced resize**
Implement the SIGWINCH handling with the 1.5s debounce for Ink backends.

- [ ] **Step 6: Expose Tauri Commands**
Create `spawn_session`, `write_to_pty`, `resize_pty`, and `kill_session` commands.

- [ ] **Step 7: Commit**
```bash
git add src-tauri/src/pty_manager.rs src-tauri/src/main.rs
git commit -m "feat(rust): implement core pty manager in rust"
```

### Task 3: IPC Bridge Migration

**Files:**
- Modify: `src/renderer/lib/tauri-ipc.ts` (Create)
- Modify: `src/renderer/hooks/useTerminal.ts`

- [ ] **Step 1: Create Tauri IPC abstraction**
Create a wrapper that provides the same interface as the Electron `window.api` but calls Tauri commands.

- [ ] **Step 2: Update useTerminal to use Tauri bridge**
Update the terminal hook to detect if it's running in Tauri and use the new IPC bridge.

- [ ] **Step 3: Commit**
```bash
git add src/renderer/lib/tauri-ipc.ts src/renderer/hooks/useTerminal.ts
git commit -m "feat(renderer): add tauri ipc bridge"
```
