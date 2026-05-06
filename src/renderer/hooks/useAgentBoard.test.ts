import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { listen } from '@tauri-apps/api/event';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tauriIpc } from '../lib/tauri-ipc';
import { useAgentBoard } from './useAgentBoard';

vi.mock('../lib/tauri-ipc', () => ({
  tauriIpc: {
    agentRefreshBurnRates: vi.fn(() => Promise.resolve()),
    agentList: vi.fn(() => Promise.resolve([])),
    aiGetHealthStatus: vi.fn(() => Promise.resolve({})),
    onAgentStatusChanged: vi.fn(() => Promise.resolve(vi.fn())),
    onAgentRegistered: vi.fn(() => Promise.resolve(vi.fn())),
    onAgentMetricsChanged: vi.fn(() => Promise.resolve(vi.fn())),
    agentUpdateStatus: vi.fn(() => Promise.resolve()),
    agentCancelTask: vi.fn(() => Promise.resolve()),
    agentListTasks: vi.fn(() => Promise.resolve([])),
    agentUpdateTaskPriority: vi.fn(() => Promise.resolve()),
    agentListTraces: vi.fn(() => Promise.resolve([])),
    agentAddTrace: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(vi.fn())),
}));

const agents = [
  {
    id: 'a1',
    name: 'Alpha',
    role: 'builder',
    status: 'idle',
    model: 'sonnet',
    provider: 'claude',
    burn_rate: 0,
    quality_score: 1,
    queue_size: 0,
  },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(tauriIpc.agentList).mockResolvedValue(agents);
  vi.mocked(tauriIpc.aiGetHealthStatus).mockResolvedValue({
    claude: 'healthy',
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAgentBoard', () => {
  it('loads agents, refreshes burn rates, and stores provider health', async () => {
    const { result } = renderHook(() => useAgentBoard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(tauriIpc.agentRefreshBurnRates).toHaveBeenCalled();
    expect(result.current.agents).toEqual(agents);
    expect(result.current.providerHealth).toEqual({ claude: 'healthy' });
  });

  it('updates agent status and metrics from live events', async () => {
    let statusCallback: (data: { id: string; status: string }) => void =
      () => {};
    let metricsCallback: (data: {
      id: string;
      burn_rate: number;
      quality_score: number;
      error_rate: number;
      queue_size: number;
      active_task?: string;
      evolution_confidence: number;
      evolution_status: string;
    }) => void = () => {};
    vi.mocked(tauriIpc.onAgentStatusChanged).mockImplementation((callback) => {
      statusCallback = callback;
      return Promise.resolve(vi.fn());
    });
    vi.mocked(tauriIpc.onAgentMetricsChanged).mockImplementation((callback) => {
      metricsCallback = callback;
      return Promise.resolve(vi.fn());
    });

    const { result } = renderHook(() => useAgentBoard(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      statusCallback({ id: 'a1', status: 'working' });
      metricsCallback({
        id: 'a1',
        burn_rate: 0.5,
        quality_score: 0.8,
        error_rate: 0.1,
        queue_size: 2,
        active_task: 'Self-heal test gaps',
        evolution_confidence: 0.9,
        evolution_status: 'learning',
      });
    });

    await waitFor(() =>
      expect(result.current.agents[0]).toMatchObject({
        status: 'working',
        burn_rate: 0.5,
        quality_score: 0.8,
        queue_size: 2,
        active_task: 'Self-heal test gaps',
        evolution_confidence: 0.9,
        evolution_status: 'learning',
      })
    );
  });

  it('pops newly registered agents onto the board', async () => {
    let registerCallback: (agent: (typeof agents)[number]) => void = () => {};
    vi.mocked(tauriIpc.onAgentRegistered).mockImplementation((callback) => {
      registerCallback = callback;
      return Promise.resolve(vi.fn());
    });

    const { result } = renderHook(() => useAgentBoard(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      registerCallback({ ...agents[0], id: 'a2', name: 'Beta' });
    });

    await waitFor(() =>
      expect(result.current.agents.map((agent) => agent.name)).toEqual([
        'Beta',
        'Alpha',
      ])
    );

    expect(tauriIpc.agentList).toHaveBeenCalled();
  });

  it('forwards imperative agent actions and refreshes after status-changing calls', async () => {
    const { result } = renderHook(() => useAgentBoard(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateStatus('a1', 'waiting');
      await result.current.cancelTask('a1');
      await result.current.updateTaskPriority('task-1', 4);
      await result.current.listTasks('a1');
      await result.current.listTraces('a1');
      await result.current.addTrace({ id: 'trace-1' });
    });

    expect(tauriIpc.agentUpdateStatus).toHaveBeenCalledWith('a1', 'waiting');
    expect(tauriIpc.agentCancelTask).toHaveBeenCalledWith('a1');
    expect(tauriIpc.agentUpdateTaskPriority).toHaveBeenCalledWith('task-1', 4);
    expect(tauriIpc.agentListTasks).toHaveBeenCalledWith('a1');
    expect(tauriIpc.agentListTraces).toHaveBeenCalledWith('a1');
    expect(tauriIpc.agentAddTrace).toHaveBeenCalledWith({ id: 'trace-1' });
  });

  it('cleans up interval and Tauri listeners on unmount', async () => {
    const unsubs = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
    vi.mocked(tauriIpc.onAgentStatusChanged).mockResolvedValue(unsubs[0]);
    vi.mocked(tauriIpc.onAgentRegistered).mockResolvedValue(unsubs[1]);
    vi.mocked(tauriIpc.onAgentMetricsChanged).mockResolvedValue(unsubs[2]);
    vi.mocked(listen).mockResolvedValue(unsubs[3]);

    const { result, unmount } = renderHook(() => useAgentBoard(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    unmount();
    await act(async () => {
      await Promise.resolve();
    });

    expect(unsubs[0]).toHaveBeenCalledOnce();
    expect(unsubs[1]).toHaveBeenCalledOnce();
    expect(unsubs[2]).toHaveBeenCalledOnce();
    expect(unsubs[3]).toHaveBeenCalledOnce();
  });
});
