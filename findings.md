# Findings: Simple Code GUI Audit

## 1. Visual Mismatches
- **Radius**: Currently using `rounded-[2rem]`, which is too aggressive. Codex uses soft corners (~12px).
- **Background**: `index.css` variables are not deep enough. Codex has a very dark, near-black but slightly navy background.
- **Glassmorphism**: Present but not refined. Needs to be more subtle and consistent.

## 2. Functional Dead-Ends
- **electronAPI**: The shim in `tauriShim.ts` is incomplete. Many hooks (Settings, Installation, Updates) call missing methods.
- **Window Controls**: Minimize/Maximize/Close buttons in `TitleBar.tsx` call `window.electronAPI.windowMinimize/Maximize/Close`, which are missing in the shim and backend.
- **PTY Management**: Claude Code terminal might be failing due to command resolution in Rust.

## 3. Draggability Issues
- `data-tauri-drag-region` is present on `TitleBar.tsx` but might be blocked by styling or lack of content flow.

## 4. UI/UX Suggestions
- **Sidebar Collapse**: The "light bubble + arrow" is missing.
- **Icons**: Lucide icons are used, but could be styled more like the high-fidelity ones in Codex.
