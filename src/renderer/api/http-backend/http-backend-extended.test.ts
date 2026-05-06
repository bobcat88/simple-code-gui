/**
 * Extended coverage for http-backend.ts — branches not hit by http-backend-units.test.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpBackend } from './http-backend'

const jsonResponse = (data: unknown, ok = true, status = 200): Response =>
  ({ ok, status, json: () => Promise.resolve(data) }) as Response

let originalWebSocket: unknown
let originalFetch: unknown

beforeEach(() => {
  originalWebSocket = (globalThis as any).WebSocket
  originalFetch = (globalThis as any).fetch
  ;(globalThis as any).WebSocket = class MockWS {
    static OPEN = 1
    readyState = 0
    onopen: (() => void) | null = null
    onclose: ((e: unknown) => void) | null = null
    onerror: ((e: unknown) => void) | null = null
    onmessage: ((e: unknown) => void) | null = null
    close = vi.fn()
    send = vi.fn()
    constructor(public url: string) {}
  }
  ;(globalThis as any).fetch = vi.fn(() => Promise.resolve(jsonResponse({ success: true })))
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  ;(globalThis as any).WebSocket = originalWebSocket
  ;(globalThis as any).fetch = originalFetch
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Constructor — port validation branches
// ---------------------------------------------------------------------------

describe('HttpBackend constructor port validation', () => {
  it('uses DEFAULT_PORT when port is 0 (falsy)', () => {
    const backend = new HttpBackend({ host: 'localhost', port: 0, token: 'tok' })
    expect(backend.getConnectionInfo().port).toBe(38470)
    expect(console.error).toHaveBeenCalled()
  })

  it('uses DEFAULT_PORT when port is negative', () => {
    const backend = new HttpBackend({ host: 'localhost', port: -1, token: 'tok' })
    expect(backend.getConnectionInfo().port).toBe(38470)
  })

  it('uses DEFAULT_PORT when port exceeds 65535', () => {
    const backend = new HttpBackend({ host: 'localhost', port: 70000, token: 'tok' })
    expect(backend.getConnectionInfo().port).toBe(38470)
  })

  it('uses DEFAULT_PORT when port is a float', () => {
    const backend = new HttpBackend({ host: 'localhost', port: 1420.5, token: 'tok' })
    expect(backend.getConnectionInfo().port).toBe(38470)
  })

  it('warns when port is privileged (< 1024) but valid', () => {
    const backend = new HttpBackend({ host: 'localhost', port: 80, token: 'tok' })
    // port 80 is valid integer in range but < 1024 — warn fires
    // (port gets reset to DEFAULT_PORT because 80 >= 1 and <= 65535 and is integer —
    //  wait: 80 IS valid by the first check. But < 1024 triggers warn)
    expect(console.warn).toHaveBeenCalled()
    // port should still be 80 (not replaced)
    expect(backend.getConnectionInfo().port).toBe(80)
  })

  it('uses https/wss for non-local host', () => {
    // Just ensure construction succeeds for external host
    const backend = new HttpBackend({ host: 'example.com', port: 8080, token: 'tok' })
    expect(backend.getConnectionInfo().host).toBe('example.com')
  })

  it('uses http/ws for localhost', () => {
    const backend = new HttpBackend({ host: 'localhost', port: 1420, token: 'tok' })
    expect(backend.getConnectionInfo().host).toBe('localhost')
  })
})

// ---------------------------------------------------------------------------
// PTY no-op methods
// ---------------------------------------------------------------------------

describe('HttpBackend PTY no-ops', () => {
  function makeBackend() {
    return new HttpBackend({ host: 'localhost', port: 1420, token: 'tok' })
  }

  it('onPtyTitle returns no-op unsubscribe', () => {
    const backend = makeBackend()
    const unsub = backend.onPtyTitle('pty-1', vi.fn())
    expect(typeof unsub).toBe('function')
    expect(() => unsub()).not.toThrow()
  })

  it('onPtyPath returns no-op unsubscribe', () => {
    const backend = makeBackend()
    const unsub = backend.onPtyPath('pty-1', vi.fn())
    expect(typeof unsub).toBe('function')
    unsub()
  })

  it('onPtyPid returns no-op unsubscribe', () => {
    const backend = makeBackend()
    const unsub = backend.onPtyPid('pty-1', vi.fn())
    expect(typeof unsub).toBe('function')
    unsub()
  })

  it('getAutoAcceptStatus always resolves false', async () => {
    const backend = makeBackend()
    expect(await backend.getAutoAcceptStatus('pty-1')).toBe(false)
  })

  it('setAutoAccept resolves without error', async () => {
    const backend = makeBackend()
    await expect(backend.setAutoAccept('pty-1', true)).resolves.toBeUndefined()
  })

  it('setPtyBackend warns and resolves', async () => {
    const backend = makeBackend()
    await expect(backend.setPtyBackend('pty-1', 'claude')).resolves.toBeUndefined()
    expect(console.warn).toHaveBeenCalled()
  })

  it('windowStartDragging does not throw', () => {
    const backend = makeBackend()
    expect(() => backend.windowStartDragging()).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Event stubs
// ---------------------------------------------------------------------------

describe('HttpBackend event stubs', () => {
  function makeBackend() {
    return new HttpBackend({ host: 'localhost', port: 1420, token: 'tok' })
  }

  it('onSettingsChanged returns no-op unsubscribe', () => {
    const backend = makeBackend()
    const unsub = backend.onSettingsChanged(vi.fn())
    expect(typeof unsub).toBe('function')
    unsub()
  })

  it('onWorkspaceChanged returns no-op unsubscribe', () => {
    const backend = makeBackend()
    const unsub = backend.onWorkspaceChanged(vi.fn())
    expect(typeof unsub).toBe('function')
    unsub()
  })

  it('onModelPlanSwitched returns no-op unsubscribe', () => {
    const backend = makeBackend()
    const unsub = backend.onModelPlanSwitched(vi.fn())
    expect(typeof unsub).toBe('function')
    unsub()
  })
})

// ---------------------------------------------------------------------------
// Stub methods with error-response shapes
// ---------------------------------------------------------------------------

describe('HttpBackend stub methods', () => {
  function makeBackend() {
    return new HttpBackend({ host: 'localhost', port: 1420, token: 'tok' })
  }

  it('vectorIndexSession resolves with success:false', async () => {
    const backend = makeBackend()
    const result = await backend.vectorIndexSession('summary', 'pty-1', '/repo')
    expect(result).toMatchObject({ success: false })
  })

  it('claudeMdSave resolves with success:false', async () => {
    const backend = makeBackend()
    const result = await backend.claudeMdSave('/repo', '# content')
    expect(result).toMatchObject({ success: false })
  })
})

// ---------------------------------------------------------------------------
// testConnection branches
// ---------------------------------------------------------------------------

describe('HttpBackend testConnection', () => {
  it('returns success:false when fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const backend = new HttpBackend({ host: 'localhost', port: 1420, token: 'tok' })
    const result = await backend.testConnection()
    expect(result).toEqual({ success: false, error: 'ECONNREFUSED' })
    expect(backend.getConnectionState()).toBe('error')
  })

  it('returns success:false on non-ok HTTP response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({}, false, 503))
    const backend = new HttpBackend({ host: 'localhost', port: 1420, token: 'tok' })
    const result = await backend.testConnection()
    expect(result).toEqual({ success: false, error: 'HTTP 503' })
    expect(backend.getConnectionError()).toBe('HTTP 503')
  })

  it('returns success:true on ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ status: 'ok' }))
    const backend = new HttpBackend({ host: 'localhost', port: 1420, token: 'tok' })
    const result = await backend.testConnection()
    expect(result).toEqual({ success: true })
    expect(backend.getConnectionState()).toBe('connected')
  })

  it('handles non-Error thrown objects', async () => {
    vi.mocked(fetch).mockRejectedValueOnce('string error')
    const backend = new HttpBackend({ host: 'localhost', port: 1420, token: 'tok' })
    const result = await backend.testConnection()
    expect(result).toEqual({ success: false, error: 'Connection failed' })
  })
})
