# Task Plan: Codex-Fidelity Modernization & Audit Fix

## Goal
Perform a full audit and fix of the "Modern" Simple Code GUI to achieve high fidelity with the Codex UI and resolve all functional dead-ends.

## Phases

- [ ] **Phase 1: Full Technical Audit & Backend Repair**
    - [ ] Implement missing window control commands in Rust (`window_minimize`, `window_maximize`, `window_close`, `window_is_maximized`).
    - [ ] Update `tauriShim.ts` to map all legacy `electronAPI` calls to Tauri commands.
    - [ ] Audit `PTY Manager` for Claude Code (`claude`) path resolution.
    - [ ] Verify window draggability logic.

- [ ] **Phase 2: Visual Fidelity Alignment (Codex Look)**
    - [ ] Deep Dark Palette: Update `index.css` with primary background `#1e1e2e` (or similar deep navy).
    - [ ] Soft Corners: Reduce radius from `2rem` to `0.75rem` (12px).
    - [ ] Glassmorphism: Refine `borg-glass` and apply to Top Bar and Sidebar.
    - [ ] TitleBar Refresh: Sleek, integrated look with working controls.

- [ ] **Phase 3: Sidebar & Component UX**
    - [ ] Hover-Activated Collapse: Implement "light bubble + arrow" button.
    - [ ] High-Fidelity Icons: Use Shadcn/UI and Lucide-React with premium styling.
    - [ ] Layout Consolidation: Match Codex sidebar structure (Threads, Automations, etc.).

- [ ] **Phase 4: Final Integration & Cleanup**
    - [ ] Remove all redundant Electron code.
    - [ ] Final performance verification.
    - [ ] Documentation update.

## Progress Tracking
- Started Phase 1 audit.
