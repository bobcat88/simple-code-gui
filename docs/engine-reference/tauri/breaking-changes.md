# Tauri 2.x — Breaking Changes

Last verified: 2026-04-21

## 2.0 (Major Release)
- **Plugin Migration**: Core features (fs, shell, clipboard, dialog) moved from core to separate plugins.
  - *Action*: Install `@tauri-apps/plugin-<name>` and add to `src-tauri/Cargo.toml`.
- **Capability System**: Replaced the `allowlist` with a granular JSON-based capability system in `src-tauri/capabilities/`.
  - *Action*: Define permission files mapping windows to specific API permissions.
- **IPC Types**: Improved DPI-aware types. Some IPC return types may have changed structure.

## 2.1 - 2.9 (Selected Changes)
- **2.8.0**: Introduced `app.on_window_event` global listener.
- **2.1.0**: `WebviewWindow::resolve_command_scope` allows runtime permission checks.

## 2.10 (Current)
- **2.10.0**: `set_simple_fullscreen` added for streamlined fullscreen.
- **2.10.0**: Native Cookie management APIs added (set/delete cookies from Rust/JS).
- **2.10.0**: `PluginHandle::run_mobile_plugin_async` for better mobile async handling.

## API Deprecations & Replacements
| Old API (v1) | New API (v2+) | Notes |
|--------------|---------------|-------|
| `window.onInstallProgress` | Plugin-specific event | Moved to `@tauri-apps/plugin-updater` |
| `fs.readTextFile` | `@tauri-apps/plugin-fs` | Now requires plugin installation |
| `shell.open` | `@tauri-apps/plugin-shell` | Granular scope required in capabilities |
