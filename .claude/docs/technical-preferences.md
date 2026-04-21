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
- [TO BE CONFIGURED]

## Testing
- **Frontend**: Vitest (React Testing Library)
- **Backend**: Rust native tests (`cargo test`)

## Forbidden Patterns
- **Direct window.electronAPI usage**: All IPC must go through the unified `Api` bridge.
- **Hardcoded secret keys**: Use `.env` or system keychain via plugins.

## Allowed Libraries
- **Frontend**: framer-motion, lucide-react, zustand, @tanstack/react-query
- **Backend**: serde, tauri-plugin-process, tauri-plugin-updater
