# Tauri 2.x — Current Best Practices

Last verified: 2026-04-21

## 1. Capability-Based Security
- **Rule**: Never use a single monolithic capability file.
- **Practice**: Split capabilities by feature or window (e.g., `main.json`, `updater.json`) in `src-tauri/capabilities/`.
- **Practice**: Use `scope` to restrict file system or shell access to specific directories or executables.

## 2. Plugin Architecture
- **Rule**: Favor plugins for shared logic across windows.
- **Practice**: When creating custom backend features, structure them as local plugins if they might be reused.
- **Practice**: Use the new `PluginHandle::run_mobile_plugin_async` if targeting mobile, even for desktop-first apps to ensure future portability.

## 3. Window & Webview Control
- **Rule**: Avoid direct DOM-based fullscreen/window logic if a native API exists.
- **Practice**: Use `set_simple_fullscreen` (v2.10.0+) for standard fullscreen requirements.
- **Practice**: Use `app.on_window_event` (v2.8.0+) for centralized window management instead of per-window listeners where possible.

## 4. IPC Performance
- **Rule**: Keep IPC payloads lean.
- **Practice**: For large data transfers, use streams or temporary files with scope-restricted access.
- **Practice**: Use `impl Into<String>` and `AsRef<str>` in Rust handlers for better memory ergonomics.

## 5. Cookie Management
- **Rule**: Use native APIs for sensitive auth state.
- **Practice**: Use the v2.10.0 Cookie APIs to manage session state natively rather than relying solely on `localStorage`.
