import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectionManager } from './connection';
import { HttpBackend } from './http-backend';
import { PtyApi } from './pty-api';
import { PtyWebSocketManager } from './pty-websocket';
import { WorkspaceApi } from './workspace-api';

type Listener = (event?: unknown) => void;

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = MockWebSocket.CONNECTING;
  onopen: Listener | null = null;
  onmessage: Listener | null = null;
  onerror: Listener | null = null;
  onclose: Listener | null = null;
  sent: string[] = [];
  close = vi.fn((code = 1000, reason = '') => {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason, wasClean: code === 1000 });
  });

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  message(payload: unknown): void {
    this.onmessage?.({
      data: typeof payload === 'string' ? payload : JSON.stringify(payload),
    });
  }

  closeFromServer(code = 1006, reason = 'lost', wasClean = false): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason, wasClean });
  }
}

const jsonResponse = (data: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: () => Promise.resolve(data),
  }) as Response;

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(jsonResponse({ success: true })))
  );
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ConnectionManager', () => {
  it('tracks connected/error states and authenticates fetch requests', async () => {
    const states: string[] = [];
    const manager = new ConnectionManager('http://host:1420', 'token');
    const unsubscribe = manager.onConnectionStateChange((state) =>
      states.push(state)
    );

    await manager.fetchJson('/api/settings');

    expect(fetch).toHaveBeenCalledWith(
      'http://host:1420/api/settings',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      })
    );
    expect(manager.getConnectionState()).toBe('connected');
    expect(states).toEqual(['connected']);

    unsubscribe();
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    await expect(manager.fetch('/api/down')).rejects.toThrow('offline');
    expect(manager.getConnectionState()).toBe('error');
    expect(manager.getConnectionError()).toBe('offline');
  });

  it('throws API error bodies for non-ok JSON responses', async () => {
    const manager = new ConnectionManager('http://host:1420', 'token');
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse({ error: 'denied' }, false, 403)
    );

    await expect(manager.fetchJson('/api/private')).rejects.toThrow('denied');
  });
});

describe('PtyWebSocketManager and PtyApi', () => {
  it('buffers PTY data until callbacks attach, forwards exits, and sends input over socket', () => {
    const ws = new PtyWebSocketManager('ws://host:1420', 'token value');
    ws.connectPtyStream('pty-1');
    const socket = MockWebSocket.instances[0];

    expect(socket.url).toBe(
      'ws://host:1420/api/pty/pty-1/stream?token=token%20value'
    );
    socket.open();
    socket.message({ type: 'data', data: 'first' });

    const data = vi.fn();
    const exit = vi.fn();
    const api = new PtyApi(
      new ConnectionManager('http://host:1420', 'token'),
      ws
    );
    api.onPtyData('pty-1', data);
    api.onPtyExit('pty-1', exit);

    expect(data).toHaveBeenCalledWith('first');
    expect(ws.sendToPty('pty-1', { type: 'input', data: 'ls' })).toBe(true);
    expect(socket.sent.at(-1)).toBe(
      JSON.stringify({ type: 'input', data: 'ls' })
    );

    socket.message({ type: 'exit', code: 7 });
    expect(exit).toHaveBeenCalledWith(7);
    expect(ws.getPtyWebsockets().has('pty-1')).toBe(false);
  });

  it('reconnects abnormal closes and disconnects cleanly', () => {
    vi.useFakeTimers();
    const ws = new PtyWebSocketManager('ws://host:1420', 'token');
    ws.connectPtyStream('pty-1');
    MockWebSocket.instances[0].closeFromServer(1006, 'lost', false);

    vi.runOnlyPendingTimers();

    expect(MockWebSocket.instances).toHaveLength(2);
    ws.disconnectPtyStream('pty-1');
    expect(ws.getPtyWebsockets().has('pty-1')).toBe(false);
  });

  it('spawns, kills, writes, resizes, and subscribes through PTY API fallbacks', async () => {
    const connection = new ConnectionManager('http://host:1420', 'token');
    const ws = new PtyWebSocketManager('ws://host:1420', 'token');
    const api = new PtyApi(connection, ws);
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ ptyId: 'pty-9' }));

    await expect(
      api.spawnPty('/repo', 'sid', 'sonnet', 'claude', 24, 80)
    ).resolves.toBe('pty-9');
    expect(fetch).toHaveBeenCalledWith(
      'http://host:1420/api/pty/spawn',
      expect.objectContaining({ method: 'POST' })
    );

    api.writePty('missing', 'data');
    api.resizePty('missing', 120, 40);
    api.killPty('missing');

    expect(fetch).toHaveBeenCalledWith(
      'http://host:1420/api/pty/missing/write',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetch).toHaveBeenCalledWith(
      'http://host:1420/api/pty/missing/resize',
      expect.objectContaining({ method: 'POST' })
    );
    expect(fetch).toHaveBeenCalledWith(
      'http://host:1420/api/pty/missing',
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});

describe('WorkspaceApi, OrchestrationApi, and HttpBackend', () => {
  it('maps workspace/session/settings/TTS endpoints and safe unsupported actions', async () => {
    const connection = new ConnectionManager('http://host:1420', 'token');
    const api = new WorkspaceApi(connection);

    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ sessions: [{ id: 's1' }] }))
      .mockResolvedValueOnce(jsonResponse({ projects: [] }))
      .mockResolvedValueOnce(jsonResponse({ theme: 'dark' }))
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ success: true, audioData: 'abc' }))
      .mockResolvedValueOnce(jsonResponse({ success: true }));

    await expect(api.discoverSessions('/repo/a b', 'codex')).resolves.toEqual([
      { id: 's1' },
    ]);
    await expect(api.getWorkspace()).resolves.toEqual({ projects: [] });
    await api.saveWorkspace({ projects: [] } as never);
    await expect(api.getSettings()).resolves.toEqual({ theme: 'dark' });
    await api.saveSettings({ theme: 'light' } as never);
    await expect(api.addProject()).resolves.toBeNull();
    await expect(api.addProjectsFromParent()).resolves.toBeNull();
    await expect(api.ttsInstallInstructions('/repo')).resolves.toEqual({
      success: false,
    });
    await expect(api.ttsSpeak('hello')).resolves.toEqual({
      success: true,
      audioData: 'abc',
    });
    await expect(api.ttsStop()).resolves.toEqual({ success: true });

    expect(fetch).toHaveBeenCalledWith(
      'http://host:1420/api/sessions?path=%2Frepo%2Fa+b&backend=codex',
      expect.any(Object)
    );
    expect(fetch).toHaveBeenCalledWith(
      'http://host:1420/api/settings',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('approves, rejects, tests connection, exposes info, and disconnects', async () => {
    const backend = new HttpBackend({
      host: 'example.com',
      port: 0,
      token: 'tok',
    });
    const states: string[] = [];
    backend.onConnectionStateChange((state) => states.push(state));

    await backend.approveAction('a1');
    await backend.rejectAction('a2');
    await expect(backend.testConnection()).resolves.toEqual({ success: true });

    expect(backend.getConnectionInfo()).toEqual({
      host: 'example.com',
      port: 38470,
      token: 'tok',
    });
    expect(states).toContain('connected');

    backend.disconnect();
    expect(backend.getConnectionState()).toBe('disconnected');
    await expect(backend.claudeMdRead('/repo')).resolves.toMatchObject({
      success: false,
    });
    await expect(backend.vectorIndexKnowledge()).resolves.toMatchObject({
      success: false,
    });
    await expect(backend.mcpGetServers()).resolves.toEqual([]);
  });
});
