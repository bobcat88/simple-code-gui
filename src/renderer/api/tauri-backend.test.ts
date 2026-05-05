import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TauriBackend } from './tauri-backend'
import { tauriIpc } from '../lib/tauri-ipc'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn(() => Promise.resolve()),
}))

const ipcFns = vi.hoisted(() => new Map<string, ReturnType<typeof vi.fn>>())

vi.mock('../lib/tauri-ipc', () => ({
  tauriIpc: new Proxy({}, {
    get: (_target, property) => {
      const name = String(property)
      if (!ipcFns.has(name)) {
        ipcFns.set(name, vi.fn(() => Promise.resolve([])))
      }
      return ipcFns.get(name)
    },
  }),
}))

const callback = vi.fn()
const file = { path: '/tmp/file.txt' } as unknown as File
const args = [
  '/repo',
  'id-1',
  'title',
  'description',
  'claude',
  24,
  80,
  { value: true },
  ['chunk'],
  callback,
  file,
]

beforeEach(() => {
  for (const fn of ipcFns.values()) fn.mockClear().mockResolvedValue([])
  callback.mockClear()
  vi.mocked(check).mockResolvedValue(null)
  vi.mocked(relaunch).mockClear()
  vi.spyOn(window, 'open').mockImplementation(() => null)
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { reload: vi.fn() },
  })
})

describe('TauriBackend', () => {
  it('delegates core PTY, workspace, settings, and project methods to tauriIpc', async () => {
    const backend = new TauriBackend()

    await backend.spawnPty('/repo', 'session-1', 'sonnet', 'codex', 40, 120, 'nexus-1')
    backend.killPty('pty-1')
    backend.writePty('pty-1', 'help')
    backend.resizePty('pty-1', 120, 40)
    await backend.setPtyBackend('pty-1', 'gemini')
    await backend.setAutoAccept('pty-1', true)
    await backend.getWorkspace()
    await backend.saveWorkspace({ projects: [], categories: [], openTabs: [], activeTabId: null })
    await backend.getSettings()
    await backend.saveSettings({} as never)
    await backend.aiSaveKey('openai', 'key', 'https://api.test')
    await backend.addProject()

    expect(tauriIpc.spawnSession).toHaveBeenCalledWith('/repo', 'codex', 'session-1', 'sonnet', 40, 120, 'nexus-1')
    expect(tauriIpc.killSession).toHaveBeenCalledWith('pty-1')
    expect(tauriIpc.writeToPty).toHaveBeenCalledWith('pty-1', 'help')
    expect(tauriIpc.resizePty).toHaveBeenCalledWith('pty-1', 120, 40)
    expect(tauriIpc.setPtyBackend).toHaveBeenCalledWith('pty-1', 'gemini')
    expect(tauriIpc.saveWorkspace).toHaveBeenCalled()
    expect(tauriIpc.aiSaveKey).toHaveBeenCalledWith('openai', 'key', 'https://api.test')
  })

  it('returns safe fallbacks when critical workspace/settings calls fail', async () => {
    const backend = new TauriBackend()
    vi.mocked(tauriIpc.getWorkspace).mockRejectedValueOnce(new Error('offline'))
    vi.mocked(tauriIpc.getSettings).mockRejectedValueOnce(new Error('offline'))
    vi.mocked(tauriIpc.discoverSessions).mockRejectedValueOnce(new Error('offline'))

    await expect(backend.getWorkspace()).resolves.toEqual({ projects: [], categories: [], openTabs: [], activeTabId: null })
    await expect(backend.getSettings()).resolves.toEqual({})
    await expect(backend.discoverSessions('/repo')).resolves.toEqual([])
  })

  it('covers remaining backend API methods with smoke calls', async () => {
    const backend = new TauriBackend()
    const skip = new Set(['constructor', 'refresh', 'openExternal'])

    for (const name of Object.getOwnPropertyNames(TauriBackend.prototype)) {
      if (skip.has(name)) continue
      const method = (backend as unknown as Record<string, (...methodArgs: unknown[]) => unknown>)[name]
      const result = method.apply(backend, args)
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        await result
      }
    }

    await backend.openExternal('https://example.test')
    await backend.refresh()

    expect(window.open).toHaveBeenCalledWith('https://example.test', '_blank')
    expect(window.location.reload).toHaveBeenCalled()
    expect(tauriIpc.vectorSearch).toHaveBeenCalled()
    expect(tauriIpc.claudeCheck).toHaveBeenCalled()
    expect(tauriIpc.mcpIsNodeTrusted).toHaveBeenCalled()
  })

  it('handles updater and relaunch outcomes', async () => {
    const backend = new TauriBackend()
    vi.mocked(check).mockResolvedValueOnce({ version: '2.1.0', body: 'notes' } as never)
    vi.mocked(check).mockResolvedValueOnce({
      downloadAndInstall: vi.fn(() => Promise.resolve()),
    } as never)

    await expect(backend.checkForUpdate()).resolves.toEqual({ available: true, version: '2.1.0', body: 'notes' })
    await expect(backend.downloadUpdate()).resolves.toEqual({ success: true })
    await backend.installUpdate()

    expect(relaunch).toHaveBeenCalledOnce()
  })
})
