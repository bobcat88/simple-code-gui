import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Tauri APIs are not available in jsdom test environment — mock them globally
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
  emit: vi.fn().mockResolvedValue(undefined),
}))
