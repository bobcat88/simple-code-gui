import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocketManager } from './websocket-manager';

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
  onclose: Listener | null = null;
  onerror: Listener | null = null;
  sent: string[] = [];
  close = vi.fn((code = 1000, reason = '') => {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason });
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
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal('WebSocket', MockWebSocket);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('WebSocketManager', () => {
  it('authenticates, flushes queued terminal messages, and dispatches callbacks', async () => {
    const manager = new WebSocketManager({
      host: '127.0.0.1',
      port: 1420,
      token: 'secret',
    });
    const onConnect = vi.fn();
    const data = vi.fn();
    const anyData = vi.fn();
    const exit = vi.fn();
    const anyExit = vi.fn();

    manager.onConnect(onConnect);
    manager.onTerminalData('pty-1', data);
    manager.onAnyTerminalData(anyData);
    manager.onTerminalExit('pty-1', exit);
    manager.onAnyTerminalExit(anyExit);
    manager.writeTerminal('pty-1', 'queued');

    const promise = manager.connect();
    const socket = MockWebSocket.instances[0];
    socket.open();
    socket.message({ type: 'auth:success', timestamp: 1 });
    await promise;

    expect(manager.isConnected()).toBe(true);
    expect(onConnect).toHaveBeenCalledOnce();
    expect(socket.sent.map((value) => JSON.parse(value))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'auth', payload: { token: 'secret' } }),
        expect.objectContaining({
          type: 'terminal:write',
          ptyId: 'pty-1',
          payload: { data: 'queued' },
        }),
      ])
    );

    socket.message({
      type: 'terminal:data',
      ptyId: 'pty-1',
      payload: { data: 'hello' },
    });
    socket.message({
      type: 'terminal:exit',
      ptyId: 'pty-1',
      payload: { code: 0 },
    });

    expect(data).toHaveBeenCalledWith('hello');
    expect(anyData).toHaveBeenCalledWith('pty-1', 'hello');
    expect(exit).toHaveBeenCalledWith(0);
    expect(anyExit).toHaveBeenCalledWith('pty-1', 0);
  });

  it('unsubscribes, sends control messages, and disconnects without reconnect', async () => {
    const manager = new WebSocketManager({
      host: 'localhost',
      port: 1420,
      token: 'secret',
    });
    const promise = manager.connect();
    const socket = MockWebSocket.instances[0];
    socket.open();
    socket.message({ type: 'auth:success' });
    await promise;

    const data = vi.fn();
    const unsubscribeData = manager.onTerminalData('pty-2', data);
    const unsubscribeExit = manager.onTerminalExit('pty-2', vi.fn());
    manager.resizeTerminal('pty-2', 120, 40);
    unsubscribeData();
    unsubscribeExit();
    manager.disconnect();

    expect(socket.sent.map((value) => JSON.parse(value))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'subscribe', ptyId: 'pty-2' }),
        expect.objectContaining({
          type: 'terminal:resize',
          ptyId: 'pty-2',
          payload: { cols: 120, rows: 40 },
        }),
        expect.objectContaining({ action: 'unsubscribe', ptyId: 'pty-2' }),
      ])
    );
    expect(manager.isConnected()).toBe(false);
  });

  it('rejects auth failures and schedules reconnects on disconnect', async () => {
    vi.useFakeTimers();
    const manager = new WebSocketManager({
      host: 'localhost',
      port: 1420,
      token: 'secret',
    });
    const onDisconnect = vi.fn();
    manager.onDisconnect(onDisconnect);

    const failed = manager.connect();
    MockWebSocket.instances[0].open();
    MockWebSocket.instances[0].message({ type: 'auth:failure' });
    await expect(failed).rejects.toThrow('Authentication failed');

    const connecting = manager.connect();
    const socket = MockWebSocket.instances[1];
    socket.open();
    socket.message({ type: 'auth:success' });
    await connecting;

    socket.close(1006, 'lost');
    expect(onDisconnect).toHaveBeenCalled();
    vi.runOnlyPendingTimers();
    expect(MockWebSocket.instances.length).toBeGreaterThan(2);
  });
});
