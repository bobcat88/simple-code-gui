# Task Plan: Codex-Fidelity Modernization & Audit Fix

## Goal
Perform a full audit and fix of the "Modern" Simple Code GUI to achieve high fidelity with the Codex UI and resolve all functional dead-ends.

## Phases

- [x] **Phase 1: Full Technical Audit & Backend Repair**
    - [x] Implement missing window control commands in Rust (`window_minimize`, `window_maximize`, `window_close`, `window_is_maximized`).
    - [x] Update `tauriShim.ts` to map all legacy `electronAPI` calls to Tauri commands.
    - [x] Audit `PTY Manager` for Claude Code (`claude`) path resolution.
    - [x] Verify window draggability logic.
    - [x] Fix `linuxdeploy` AppImage bundling failure by restricting targets to `.deb`.

- [x] **Phase 2: Visual Fidelity Alignment (Codex Look)**
    - [x] Deep Dark Palette: Update `index.css` with primary background `#1e1e2e` (or similar deep navy).
    - [x] Soft Corners: Reduce radius from `2rem` to `0.75rem` (12px).
    - [x] Glassmorphism: Refine `borg-glass` and apply to Top Bar and Sidebar.
    - [x] TitleBar Refresh: Sleek, integrated look with working controls.

- [x] **Phase 3: Sidebar & Component UX**
    - [x] Hover-Activated Collapse: Implement "light bubble + arrow" button.
    - [ ] High-Fidelity Icons: Use Shadcn/UI and Lucide-React with premium styling.
    - [x] Layout Consolidation: Match Codex sidebar structure (Threads, Automations, etc.).

- [/] **Phase 4: Final Integration & Cleanup**
    - [x] Remove all redundant Electron code (tsconfig, package.json).
    - [ ] Final performance verification.
    - [x] Documentation update.

## Progress Tracking
- Phase 1 Complete.
- Cleanup initiated.
- AppImage bundling bypassed via `.deb` target lock.
- Contract parity for `ExtendedApi` achieved in `tauriShim.ts`.
