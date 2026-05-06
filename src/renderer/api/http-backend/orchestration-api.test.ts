import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrchestrationApi } from './orchestration-api';

// Minimal mocks for dependencies
const mockFetchJson = vi.fn();
const mockConnection = { fetchJson: mockFetchJson } as unknown as import('./connection').ConnectionManager;
const mockWsManager = {} as unknown as import('./pty-websocket').PtyWebSocketManager;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('OrchestrationApi', () => {
  it('constructs without error', () => {
    const api = new OrchestrationApi(mockConnection, mockWsManager);
    expect(api).toBeDefined();
  });

  it('onAgentAction returns an unsubscribe function and logs', () => {
    const api = new OrchestrationApi(mockConnection, mockWsManager);
    const cb = vi.fn();
    const unsub = api.onAgentAction(cb);
    expect(typeof unsub).toBe('function');
    expect(console.log).toHaveBeenCalledWith(
      '[OrchestrationApi] onAgentAction subscribed (stub)'
    );
    // unsubscribe is a no-op stub
    expect(() => unsub()).not.toThrow();
  });

  it('onAgentStatus returns an unsubscribe function and logs', () => {
    const api = new OrchestrationApi(mockConnection, mockWsManager);
    const cb = vi.fn();
    const unsub = api.onAgentStatus(cb);
    expect(typeof unsub).toBe('function');
    expect(console.log).toHaveBeenCalledWith(
      '[OrchestrationApi] onAgentStatus subscribed (stub)'
    );
    expect(() => unsub()).not.toThrow();
  });

  it('approveAction POSTs to the correct endpoint and returns response', async () => {
    mockFetchJson.mockResolvedValueOnce({ success: true });
    const api = new OrchestrationApi(mockConnection, mockWsManager);
    const result = await api.approveAction('action-123');
    expect(mockFetchJson).toHaveBeenCalledWith(
      '/api/orchestration/approve/action-123',
      { method: 'POST' }
    );
    expect(result).toEqual({ success: true });
  });

  it('rejectAction POSTs to the correct endpoint and returns response', async () => {
    mockFetchJson.mockResolvedValueOnce({ success: false });
    const api = new OrchestrationApi(mockConnection, mockWsManager);
    const result = await api.rejectAction('action-456');
    expect(mockFetchJson).toHaveBeenCalledWith(
      '/api/orchestration/reject/action-456',
      { method: 'POST' }
    );
    expect(result).toEqual({ success: false });
  });

  it('approveAction propagates errors from connection', async () => {
    mockFetchJson.mockRejectedValueOnce(new Error('network fail'));
    const api = new OrchestrationApi(mockConnection, mockWsManager);
    await expect(api.approveAction('x')).rejects.toThrow('network fail');
  });

  it('rejectAction propagates errors from connection', async () => {
    mockFetchJson.mockRejectedValueOnce(new Error('server error'));
    const api = new OrchestrationApi(mockConnection, mockWsManager);
    await expect(api.rejectAction('y')).rejects.toThrow('server error');
  });
});
