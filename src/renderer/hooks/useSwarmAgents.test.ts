import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSwarmAgents } from './useSwarmAgents';
import { tauriIpc } from '../lib/tauri-ipc';

vi.mock('../lib/tauri-ipc', () => ({
  tauriIpc: {
    agentList: vi.fn(),
    onAgentStatusChanged: vi.fn(() => Promise.resolve(() => {})),
    setPtyBackend: vi.fn(() => Promise.resolve()),
  },
}));

const mockAgents = [
  { id: 'a1', name: 'Alpha', role: 'worker', status: 'active', model: 'opus', provider: 'claude', burn_rate: 0, quality_score: 1, queue_size: 0 },
  { id: 'a2', name: 'Beta',  role: 'worker', status: 'active', model: 'default', provider: 'gemini', burn_rate: 0, quality_score: 1, queue_size: 0 },
];

beforeEach(() => {
  vi.mocked(tauriIpc.agentList).mockResolvedValue(mockAgents);
  vi.mocked(tauriIpc.setPtyBackend).mockClear();
});

describe('useSwarmAgents', () => {
  it('loads agents from agentList on mount', async () => {
    const { result } = renderHook(() => useSwarmAgents());
    await act(async () => {});
    expect(result.current.agents).toHaveLength(2);
    expect(result.current.agents[0].id).toBe('a1');
  });

  it('setPending updates pending map without touching agents', async () => {
    const { result } = renderHook(() => useSwarmAgents());
    await act(async () => {});
    act(() => { result.current.setPending('a1', { provider: 'gemini', model: 'flash' }); });
    expect(result.current.pending['a1']).toEqual({ provider: 'gemini', model: 'flash' });
    expect(result.current.agents[0].provider).toBe('claude');
  });

  it('applyChanges calls setPtyBackend only for agents with changed provider', async () => {
    const { result } = renderHook(() => useSwarmAgents());
    await act(async () => {});
    act(() => { result.current.setPending('a1', { provider: 'gemini', model: 'flash' }); });
    await act(async () => { await result.current.applyChanges(); });
    expect(tauriIpc.setPtyBackend).toHaveBeenCalledOnce();
    expect(tauriIpc.setPtyBackend).toHaveBeenCalledWith('a1', 'gemini');
  });

  it('applyChanges skips agents where pending provider matches current provider', async () => {
    const { result } = renderHook(() => useSwarmAgents());
    await act(async () => {});
    act(() => { result.current.setPending('a1', { provider: 'claude', model: 'sonnet' }); });
    await act(async () => { await result.current.applyChanges(); });
    expect(tauriIpc.setPtyBackend).not.toHaveBeenCalled();
  });

  it('hasChanges is false when no pending changes differ from current state', async () => {
    const { result } = renderHook(() => useSwarmAgents());
    await act(async () => {});
    expect(result.current.hasChanges).toBe(false);
  });

  it('hasChanges is true when a pending provider differs from current', async () => {
    const { result } = renderHook(() => useSwarmAgents());
    await act(async () => {});
    act(() => { result.current.setPending('a1', { provider: 'codex', model: 'default' }); });
    expect(result.current.hasChanges).toBe(true);
  });
});
