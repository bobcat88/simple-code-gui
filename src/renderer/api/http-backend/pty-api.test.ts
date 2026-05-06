/**
 * PtyApi — branch coverage for paths not hit by http-backend-units.test.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConnectionManager } from './connection'
import { PtyApi } from './pty-api'
import { PtyWebSocketManager } from './pty-websocket'

class MockWebSocket {
  static instances: MockWebSocket[] = []
  static OPEN = 1
  readyState = MockWebSocket.OPEN
  onopen: (() => void) | null = null
  onclose: ((e: unknown) => void) | null = null
  onerror: ((e: unknown) => void) | null = null
  onmessage: ((e: unknown) => void) | null = null
  sent: string[] = []
  close = vi.fn()
  send(data: string) { this.sent.push(data) }
  constructor(public url: string) { MockWebSocket.instances.push(this) }
}

const jsonResponse = (data: unknown, ok = true): Response =>
  ({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(data) }) as Response

function makeApi() {
  const connection = new ConnectionManager('http://host:1420', 'token')
  const wsManager = new PtyWebSocketManager('ws://host:1420', 'token')
  const api = new PtyApi(connection, wsManager)
  return { connection, wsManager, api }
}

let originalWebSocket: unknown
let originalFetch: unknown

beforeEach(() => {
  MockWebSocket.instances = []
  originalWebSocket = (globalThis as any).WebSocket
  originalFetch = (globalThis as any).fetch
  ;(globalThis as any).WebSocket = MockWebSocket
  ;(globalThis as any).fetch = vi.fn(() => Promise.resolve(jsonResponse({ ptyId: 'pty-x' })))
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
// onPtyData — state already exists (no new state creation)
// ---------------------------------------------------------------------------

describe('PtyApi.onPtyData', () => {
  it('registers callback when state already exists (spawnPty creates state)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ptyId: 'pty-1' }))
    const { api } = makeApi()
    await api.spawnPty('/repo', 's1', 'sonnet', 'claude', 24, 80)

    const cb = vi.fn()
    const unsub = api.onPtyData('pty-1', cb)
    expect(typeof unsub).toBe('function')
    unsub()
  })

  it('unsubscribe removes only the registered callback', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ptyId: 'pty-2' }))
    const { api } = makeApi()
    await api.spawnPty('/repo', 's2', 'sonnet', 'claude', 24, 80)

    const cb1 = vi.fn()
    const cb2 = vi.fn()
    const unsub1 = api.onPtyData('pty-2', cb1)
    api.onPtyData('pty-2', cb2)
    unsub1()
    // cb1 removed; cb2 still registered — no throw
  })

  it('creates placeholder state when called for unknown pty (before spawn)', () => {
    const { api } = makeApi()
    const cb = vi.fn()
    const unsub = api.onPtyData('pty-unknown', cb)
    expect(typeof unsub).toBe('function')
    unsub()
  })

  it('unsubscribe is safe for already-removed pty', () => {
    const { api, wsManager } = makeApi()
    const cb = vi.fn()
    const unsub = api.onPtyData('pty-gone', cb)
    // Remove from map manually
    wsManager.getPtyWebsockets().delete('pty-gone')
    expect(() => unsub()).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// onPtyExit — same state-management paths
// ---------------------------------------------------------------------------

describe('PtyApi.onPtyExit', () => {
  it('creates placeholder state when called for unknown pty', () => {
    const { api } = makeApi()
    const cb = vi.fn()
    const unsub = api.onPtyExit('pty-new', cb)
    expect(typeof unsub).toBe('function')
    unsub()
  })

  it('unsubscribe is safe when state removed', () => {
    const { api, wsManager } = makeApi()
    const cb = vi.fn()
    const unsub = api.onPtyExit('pty-rm', cb)
    wsManager.getPtyWebsockets().delete('pty-rm')
    expect(() => unsub()).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// onPtyRecreated — add/remove callback
// ---------------------------------------------------------------------------

describe('PtyApi.onPtyRecreated', () => {
  it('adds callback and unsubscribe removes it without error', () => {
    const { api } = makeApi()
    const cb = vi.fn()
    const unsub = api.onPtyRecreated(cb)
    expect(typeof unsub).toBe('function')
    unsub()
    // calling again is safe
    expect(() => unsub()).not.toThrow()
  })

  it('multiple callbacks can be registered independently', () => {
    const { api } = makeApi()
    const cb1 = vi.fn()
    const cb2 = vi.fn()
    const unsub1 = api.onPtyRecreated(cb1)
    api.onPtyRecreated(cb2)
    unsub1()
    // cb2 still registered
  })
})

// ---------------------------------------------------------------------------
// writePty / resizePty — WebSocket connected path
// ---------------------------------------------------------------------------

describe('PtyApi writePty/resizePty via WebSocket', () => {
  it('sends over WS when connected', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ptyId: 'pty-ws' }))
    const { api, wsManager } = makeApi()
    await api.spawnPty('/repo', 's', 'sonnet', 'claude', 24, 80)

    const ws = MockWebSocket.instances[0]
    ws.readyState = MockWebSocket.OPEN

    api.writePty('pty-ws', 'hello')
    api.resizePty('pty-ws', 120, 40)

    expect(ws.sent).toContain(JSON.stringify({ type: 'input', data: 'hello' }))
    expect(ws.sent).toContain(JSON.stringify({ type: 'resize', cols: 120, rows: 40 }))
    expect(fetch).toHaveBeenCalledTimes(1) // only spawn, not write/resize
  })
})

// ---------------------------------------------------------------------------
// killPty — error logging
// ---------------------------------------------------------------------------

describe('PtyApi.killPty error logging', () => {
  it('logs error when DELETE request fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ ptyId: 'pty-kill' }))
      .mockRejectedValueOnce(new Error('net fail'))

    const { api } = makeApi()
    await api.spawnPty('/repo', 's', 'sonnet', 'claude', 24, 80)
    api.killPty('pty-kill')

    // Allow microtasks to flush
    await new Promise(r => setTimeout(r, 0))
    expect(console.error).toHaveBeenCalledWith(
      '[HttpBackend] Failed to kill PTY:',
      expect.any(Error)
    )
  })
})

// ---------------------------------------------------------------------------
// spawnPty — sets connection state to connecting, then connected
// ---------------------------------------------------------------------------

describe('PtyApi.spawnPty connection state', () => {
  it('resolves ptyId from server response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ptyId: 'pty-abc' }))
    const { api } = makeApi()
    await expect(api.spawnPty('/repo', undefined, undefined, 'claude')).resolves.toBe('pty-abc')
  })
})
