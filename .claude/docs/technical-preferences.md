# Technical Preferences

## Engine & Language
- **Engine**: Tauri 2.10.3
- **Frontend**: React 18.3 (TypeScript)
- **Backend**: Rust
- **Build System**: Cargo (Rust), Vite (Frontend)

## Naming Conventions
- **TypeScript**:
  - Components: PascalCase (e.g., `SidebarContent.tsx`)
  - Functions/Variables: camelCase
  - Interfaces/Types: PascalCase
- **Rust**:
  - Structs/Enums: PascalCase
  - Functions/Variables: snake_case
  - Modules: snake_case

## Input & Platform
- **Target Platforms**: Desktop (Linux, macOS, Windows)
- **Input Methods**: Keyboard/Mouse
- **Primary Input**: Keyboard/Mouse
- **Gamepad Support**: None
- **Touch Support**: None

## Engine Specialists
- **Primary**: tauri-specialist
- **Backend Specialist**: rust-specialist
- **Frontend Specialist**: react-specialist
- **UI Specialist**: tailwind-specialist

### File Extension Routing
| File Extension | Specialist |
|----------------|------------|
| .rs | rust-specialist |
| .tsx, .ts | react-specialist |
| .css, .html | tailwind-specialist |
| tauri.conf.json | tauri-specialist |
| capabilities/*.json | tauri-specialist |

## Performance Budgets
- **Target shell interaction latency**: keep keyboard-driven terminal and sidebar actions under 100ms on a warm desktop session.
- **Project scan latency**: root-level capability scans should complete under 250ms for ordinary repositories; deeper health checks should remain explicit or backgrounded.
- **Frontend production bundle budget**: the Tauri desktop app may ship one primary renderer chunk up to 1.4 MB minified / 400 kB gzip while the app remains mostly monolithic.
- **CSS bundle budget**: renderer CSS should stay under 330 kB minified / 55 kB gzip.
- **Follow-up trigger**: if the primary renderer chunk exceeds 1.4 MB minified or 400 kB gzip, split high-cost panels with dynamic imports before adding more feature surface.
- **Current baseline (2026-04-26)**: `bun run build:frontend` produced `index-BM-aCb0e.js` at 1,314.07 kB minified / 356.32 kB gzip and `index-B54ABH4C.css` at 307.12 kB minified / 44.07 kB gzip.

## Testing
- **Frontend**: Vitest (React Testing Library)
- **Backend**: Rust native tests (`cargo test`)

## Forbidden Patterns
- **Direct window.electronAPI usage**: All IPC must go through the unified `Api` bridge.
- **Hardcoded secret keys**: Use `.env` or system keychain via plugins.

## Allowed Libraries
- **Frontend**: framer-motion, lucide-react, zustand, @tanstack/react-query
- **Backend**: serde, tauri-plugin-process, tauri-plugin-updater
