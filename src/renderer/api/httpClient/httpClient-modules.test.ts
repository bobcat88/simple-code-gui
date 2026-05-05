import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as helpers from './http-helpers'
import * as workspace from './api-workspace'
import * as beads from './api-beads'
import * as terminal from './api-terminal'
import * as misc from './api-misc'
import type { HostConfig } from '../hostConfig'

vi.mock('./http-helpers', () => ({
  get: vi.fn(() => Promise.resolve([])),
  post: vi.fn(() => Promise.resolve({ ptyId: 'pty-1', audioData: 'audio' })),
  put: vi.fn(() => Promise.resolve()),
  patch: vi.fn(() => Promise.resolve()),
  del: vi.fn(() => Promise.resolve()),
}))

const config: HostConfig = {
  host: '127.0.0.1',
  port: 1420,
  token: 'token',
}

beforeEach(() => {
  vi.mocked(helpers.get).mockReset().mockResolvedValue([])
  vi.mocked(helpers.post).mockReset().mockResolvedValue({ ptyId: 'pty-1', audioData: 'audio' })
  vi.mocked(helpers.put).mockReset().mockResolvedValue(undefined)
  vi.mocked(helpers.patch).mockReset().mockResolvedValue(undefined)
  vi.mocked(helpers.del).mockReset().mockResolvedValue(undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(window, 'open').mockImplementation(() => null)
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { reload: vi.fn() },
  })
})

describe('httpClient workspace API', () => {
  it('maps workspace and settings endpoints', async () => {
    await workspace.getWorkspace(config)
    await workspace.saveWorkspace(config, { projects: [], categories: [], openTabs: [], activeTabId: null })
    await workspace.discoverSessions(config, '/repo/a b', 'codex')
    await workspace.getSettings(config)
    await workspace.saveSettings(config, {} as never)

    expect(helpers.get).toHaveBeenCalledWith(config, '/projects')
    expect(helpers.put).toHaveBeenCalledWith(config, '/projects', expect.any(Object))
    expect(helpers.get).toHaveBeenCalledWith(config, '/terminal/discover/%2Frepo%2Fa%20b?backend=codex')
    expect(helpers.get).toHaveBeenCalledWith(config, '/settings')
    expect(helpers.put).toHaveBeenCalledWith(config, '/settings', {})
  })
})

describe('httpClient beads API', () => {
  it('returns success payloads and builds encoded task endpoints', async () => {
    vi.mocked(helpers.get).mockResolvedValueOnce([{ id: 'b1' }])
    vi.mocked(helpers.get).mockResolvedValueOnce([{ id: 'b1' }])
    vi.mocked(helpers.get).mockResolvedValueOnce({ id: 'b2' })
    vi.mocked(helpers.post).mockResolvedValueOnce({ id: 'b2' })

    await expect(beads.beadsCheck(config, '/repo/a b')).resolves.toEqual([{ id: 'b1' }])
    await expect(beads.beadsList(config, '/repo/a b')).resolves.toEqual({ success: true, tasks: [{ id: 'b1' }] })
    await expect(beads.beadsShow(config, '/repo/a b', 'task-1')).resolves.toEqual({ success: true, task: { id: 'b2' } })
    await expect(beads.beadsCreate(config, '/repo', 'Title', 'Desc', 2, 'task', 'ui')).resolves.toEqual({
      success: true,
      task: { id: 'b2' },
    })
    await expect(beads.beadsComplete(config, '/repo', 'task-1')).resolves.toEqual({
      success: true,
      result: { taskId: 'task-1', status: 'completed' },
    })
    await expect(beads.beadsDelete(config, '/repo/a b', 'task-1')).resolves.toEqual({ success: true })
    await expect(beads.beadsStart(config, '/repo', 'task-1')).resolves.toEqual({ success: true })
    await expect(beads.beadsUpdate(config, '/repo', 'task-1', 'open', 'Title', 'Desc', 1)).resolves.toEqual({ success: true })

    expect(helpers.get).toHaveBeenCalledWith(config, '/projects/beads/check?cwd=%2Frepo%2Fa%20b')
    expect(helpers.del).toHaveBeenCalledWith(config, '/projects/beads/tasks/task-1?cwd=%2Frepo%2Fa%20b')
    expect(helpers.patch).toHaveBeenCalledWith(config, '/projects/beads/tasks/task-1', expect.objectContaining({ priority: 1 }))
  })

  it('converts helper errors into Beads result objects', async () => {
    vi.mocked(helpers.post).mockRejectedValue(new Error('network down'))
    vi.mocked(helpers.get).mockRejectedValue(new Error('network down'))
    vi.mocked(helpers.patch).mockRejectedValue(new Error('network down'))
    vi.mocked(helpers.del).mockRejectedValue(new Error('network down'))

    await expect(beads.beadsInit(config, '/repo')).resolves.toEqual({ success: false, error: 'network down' })
    await expect(beads.beadsList(config, '/repo')).resolves.toEqual({ success: false, error: 'network down' })
    await expect(beads.beadsShow(config, '/repo', 'task-1')).resolves.toEqual({ success: false, error: 'network down' })
    await expect(beads.beadsCreate(config, '/repo', 'Title')).resolves.toEqual({ success: false, error: 'network down' })
    await expect(beads.beadsComplete(config, '/repo', 'task-1')).resolves.toEqual({ success: false, error: 'network down' })
    await expect(beads.beadsDelete(config, '/repo', 'task-1')).resolves.toEqual({ success: false, error: 'network down' })
    await expect(beads.beadsStart(config, '/repo', 'task-1')).resolves.toEqual({ success: false, error: 'network down' })
    await expect(beads.beadsUpdate(config, '/repo', 'task-1')).resolves.toEqual({ success: false, error: 'network down' })
  })
})

describe('httpClient terminal API', () => {
  it('connects websocket before spawning and uses websocket writes when connected', async () => {
    const wsManager = {
      isConnected: vi.fn(() => false),
      connect: vi.fn(() => Promise.resolve()),
      writeTerminal: vi.fn(),
      resizeTerminal: vi.fn(),
    } as any

    await expect(terminal.spawnPty(config, wsManager, '/repo', 'session', 'sonnet', 'claude', 24, 80)).resolves.toBe('pty-1')
    expect(wsManager.connect).toHaveBeenCalledOnce()
    expect(helpers.post).toHaveBeenCalledWith(config, '/terminal/create', expect.objectContaining({ projectPath: '/repo' }))

    vi.mocked(wsManager.isConnected).mockReturnValue(true)
    terminal.writePty(config, wsManager, 'pty-1', 'ls')
    terminal.resizePty(config, wsManager, 'pty-1', 120, 40)
    terminal.killPty(config, 'pty-1')

    expect(wsManager.writeTerminal).toHaveBeenCalledWith('pty-1', 'ls')
    expect(wsManager.resizeTerminal).toHaveBeenCalledWith('pty-1', 120, 40)
    expect(helpers.del).toHaveBeenCalledWith(config, '/terminal/pty-1')
  })

  it('falls back to HTTP when websocket is disconnected', () => {
    const wsManager = {
      isConnected: vi.fn(() => false),
      writeTerminal: vi.fn(),
      resizeTerminal: vi.fn(),
    } as any

    terminal.writePty(config, wsManager, 'pty-2', 'help')
    terminal.resizePty(config, wsManager, 'pty-2', 100, 30)

    expect(helpers.post).toHaveBeenCalledWith(config, '/terminal/pty-2/write', { data: 'help' })
    expect(helpers.post).toHaveBeenCalledWith(config, '/terminal/pty-2/resize', { cols: 100, rows: 30 })
  })
})

describe('httpClient misc API', () => {
  it('covers HTTP-backed checks, GSD, and voice helpers', async () => {
    await misc.claudeCheck(config)
    await misc.geminiCheck(config)
    await misc.codexCheck(config)
    await misc.opencodeCheck(config)
    await misc.aiderCheck(config)
    await misc.gsdProjectCheck(config, '/repo/a b')
    await expect(misc.gsdGetProgress(config, '/repo')).resolves.toEqual({ success: true, data: [] })
    await misc.voiceGetSettings(config)
    await expect(misc.voiceSpeak(config, 'hello')).resolves.toEqual({ success: true, audioData: 'audio' })
    await expect(misc.voiceStopSpeaking(config)).resolves.toEqual({ success: true })

    expect(helpers.get).toHaveBeenCalledWith(config, '/settings/cli/claude')
    expect(helpers.get).toHaveBeenCalledWith(config, '/projects/gsd/check?cwd=%2Frepo%2Fa%20b')
    expect(helpers.post).toHaveBeenCalledWith(config, '/settings/voice/speak', { text: 'hello' })
  })

  it('covers unsupported browser-only and project intelligence stubs', async () => {
    await expect(misc.addProject()).resolves.toBeNull()
    await expect(misc.selectDirectory()).resolves.toBeNull()
    await expect(misc.createProject('App', '/tmp')).resolves.toMatchObject({ success: false })
    await expect(misc.runExecutable('cmd', '/tmp')).resolves.toMatchObject({ success: false })
    await expect(misc.claudeInstall()).resolves.toMatchObject({ success: false })
    await expect(misc.nodeInstall()).resolves.toMatchObject({ success: false })
    await expect(misc.gsdCheck()).resolves.toEqual({ installed: false, npmInstalled: false })
    await expect(misc.beadsReady('/repo')).resolves.toMatchObject({ success: false })
    await expect(misc.windowIsMaximized()).resolves.toBe(false)
    await expect(misc.readClipboardImage()).resolves.toMatchObject({ success: false })
    await expect(misc.isDebugMode()).resolves.toBe(false)
    await expect(misc.getVersion()).resolves.toBe('HTTP Client')
    await expect(misc.checkForUpdate()).resolves.toMatchObject({ success: false })
    await expect(misc.apiStatus('/repo')).resolves.toEqual({ running: false })
    await expect(misc.kspecDispatchStatus('/repo')).resolves.toEqual({ running: false })
    await expect(misc.scanProjectIntelligence('/repo')).resolves.toMatchObject({ capabilities: [] })
    await expect(misc.projectApplyProposal({})).resolves.toEqual([])

    misc.debugLog('msg')
    await misc.openExternal('https://example.test')
    await misc.refresh()

    expect(window.open).toHaveBeenCalledWith('https://example.test', '_blank')
    expect(window.location.reload).toHaveBeenCalled()
  })
})
