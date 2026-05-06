/**
 * Extended coverage for api-misc.ts — error paths and untested stubs
 * (httpClient-modules.test.ts covers the happy-path HTTP-backed functions)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as helpers from './http-helpers'
import * as misc from './api-misc'
import type { HostConfig } from '../hostConfig'

vi.mock('./http-helpers', () => ({
  get: vi.fn(() => Promise.resolve({})),
  post: vi.fn(() => Promise.resolve({})),
  put: vi.fn(() => Promise.resolve()),
  patch: vi.fn(() => Promise.resolve()),
  del: vi.fn(() => Promise.resolve()),
}))

const config: HostConfig = { host: '127.0.0.1', port: 1420, token: 'tok' }

const mockGet = helpers.get as ReturnType<typeof vi.fn>
const mockPost = helpers.post as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockGet.mockReset().mockResolvedValue({})
  mockPost.mockReset().mockResolvedValue({})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(window, 'open').mockImplementation(() => null)
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { reload: vi.fn() },
  })
})

// ---------------------------------------------------------------------------
// Error paths for wrapped async helpers
// ---------------------------------------------------------------------------

describe('gsdGetProgress error path', () => {
  it('returns success:false with Error.message when get rejects with Error', async () => {
    mockGet.mockRejectedValueOnce(new Error('timeout'))
    const result = await misc.gsdGetProgress(config, '/repo')
    expect(result).toEqual({ success: false, error: 'timeout' })
  })

  it('returns success:false with "Unknown error" for non-Error rejections', async () => {
    mockGet.mockRejectedValueOnce('oops')
    const result = await misc.gsdGetProgress(config, '/repo')
    expect(result).toEqual({ success: false, error: 'Unknown error' })
  })

  it('encodes cwd in the URL', async () => {
    mockGet.mockResolvedValueOnce({ tasks: [] })
    await misc.gsdGetProgress(config, '/my dir/proj')
    expect(helpers.get).toHaveBeenCalledWith(
      config,
      '/projects/gsd/progress?cwd=%2Fmy%20dir%2Fproj'
    )
  })
})

describe('voiceSpeak error path', () => {
  it('returns success:false with Error.message on failure', async () => {
    mockPost.mockRejectedValueOnce(new Error('voice error'))
    expect(await misc.voiceSpeak(config, 'hi')).toEqual({
      success: false,
      error: 'voice error',
    })
  })

  it('returns success:false with "Unknown error" for non-Error', async () => {
    mockPost.mockRejectedValueOnce(42)
    expect(await misc.voiceSpeak(config, 'hi')).toEqual({
      success: false,
      error: 'Unknown error',
    })
  })

  it('includes audioData when present', async () => {
    mockPost.mockResolvedValueOnce({ audioData: 'base64abc' })
    expect(await misc.voiceSpeak(config, 'hello')).toEqual({
      success: true,
      audioData: 'base64abc',
    })
  })

  it('returns success:true with undefined audioData when absent', async () => {
    mockPost.mockResolvedValueOnce({})
    const result = await misc.voiceSpeak(config, 'hello')
    expect(result.success).toBe(true)
    expect(result.audioData).toBeUndefined()
  })
})

describe('voiceStopSpeaking error path', () => {
  it('returns success:false when post rejects', async () => {
    mockPost.mockRejectedValueOnce(new Error('net'))
    expect(await misc.voiceStopSpeaking(config)).toEqual({ success: false })
  })
})

// ---------------------------------------------------------------------------
// Stub functions — all synchronous or trivially resolved
// ---------------------------------------------------------------------------

describe('file dialog stubs', () => {
  it('selectExecutable resolves null and warns', async () => {
    expect(await misc.selectExecutable()).toBeNull()
    expect(console.warn).toHaveBeenCalled()
  })
})

describe('installation stubs', () => {
  it('each install stub resolves with success:false', async () => {
    const results = await Promise.all([
      misc.gitInstall(),
      misc.pythonInstall(),
      misc.geminiInstall(),
      misc.codexInstall(),
      misc.opencodeInstall(),
      misc.aiderInstall(),
      misc.gsdInstall(),
      misc.beadsInstall(),
    ])
    for (const r of results) {
      expect(r).toMatchObject({ success: false })
    }
  })

  it('onInstallProgress returns a no-op unsubscribe', () => {
    const cb = vi.fn()
    const unsub = misc.onInstallProgress(cb)
    expect(typeof unsub).toBe('function')
    unsub()
    expect(cb).not.toHaveBeenCalled()
  })
})

describe('beads stubs', () => {
  it('beadsWatch resolves success:false and warns', async () => {
    expect(await misc.beadsWatch('/repo')).toMatchObject({ success: false })
    expect(console.warn).toHaveBeenCalled()
  })

  it('beadsUnwatch resolves success:false and warns', async () => {
    expect(await misc.beadsUnwatch('/repo')).toMatchObject({ success: false })
  })

  it('onBeadsTasksChanged returns no-op unsubscribe and warns', () => {
    const cb = vi.fn()
    const unsub = misc.onBeadsTasksChanged(cb)
    expect(typeof unsub).toBe('function')
    unsub()
    expect(cb).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalled()
  })
})

describe('window control stubs', () => {
  it('windowMinimize/Maximize/Close run without error', () => {
    expect(() => misc.windowMinimize()).not.toThrow()
    expect(() => misc.windowMaximize()).not.toThrow()
    expect(() => misc.windowClose()).not.toThrow()
  })
})

describe('utility stubs', () => {
  it('getPathForFile returns empty string', () => {
    const file = new File([''], 'test.txt')
    expect(misc.getPathForFile(file)).toBe('')
  })

  it('setPtyBackend resolves void', async () => {
    await expect(misc.setPtyBackend('pty-1', 'claude')).resolves.toBeUndefined()
  })

  it('onPtyRecreated returns a no-op unsubscribe', () => {
    const cb = vi.fn()
    const unsub = misc.onPtyRecreated(cb)
    expect(typeof unsub).toBe('function')
    unsub()
    expect(cb).not.toHaveBeenCalled()
  })
})

describe('update stubs', () => {
  it('downloadUpdate and installUpdate work', async () => {
    expect(await misc.downloadUpdate()).toMatchObject({ success: false })
    expect(() => misc.installUpdate()).not.toThrow()
  })

  it('onUpdaterStatus returns no-op unsubscribe', () => {
    const cb = vi.fn()
    const unsub = misc.onUpdaterStatus(cb)
    expect(typeof unsub).toBe('function')
    unsub()
  })
})

describe('api server stubs', () => {
  it('apiStart and apiStop resolve correctly', async () => {
    expect(await misc.apiStart('/repo', 8080)).toMatchObject({ success: false })
    expect(await misc.apiStop('/repo')).toEqual({ success: false })
  })

  it('onApiOpenSession returns no-op unsubscribe', () => {
    const cb = vi.fn()
    const unsub = misc.onApiOpenSession(cb)
    expect(typeof unsub).toBe('function')
    unsub()
    expect(cb).not.toHaveBeenCalled()
  })
})

describe('kspec/intelligence stubs', () => {
  it('kspecDispatchStart and kspecDispatchStop resolve with success:false', async () => {
    expect(await misc.kspecDispatchStart('/repo')).toMatchObject({ success: false })
    expect(await misc.kspecDispatchStop('/repo')).toMatchObject({ success: false })
  })

  it('projectScan resolves with capabilities array', async () => {
    expect(await misc.projectScan('/repo')).toMatchObject({ capabilities: [] })
  })

  it('projectGenerateProposal resolves with steps', async () => {
    expect(await misc.projectGenerateProposal({}, 'default', 'App', 'claude')).toMatchObject({ steps: [] })
  })

  it('onProjectInitializationProgress returns no-op unsubscribe', () => {
    const cb = vi.fn()
    const unsub = misc.onProjectInitializationProgress(cb)
    expect(typeof unsub).toBe('function')
    unsub()
    expect(cb).not.toHaveBeenCalled()
  })
})
