import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api, ExtendedApi } from '../api/types';
import { useApi } from '../contexts/ApiContext';
import { tauriIpc } from '../lib/tauri-ipc';
import { useHealthStatus } from './useHealthStatus';
import { useProjectIntelligence } from './useProjectIntelligence';
import { useTokenStats } from './useTokenStats';

vi.mock('../contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

vi.mock('../lib/tauri-ipc', () => ({
  tauriIpc: {
    healthGetStatus: vi.fn(),
  },
}));

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
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('react-query data hooks', () => {
  it('loads token history through react-query and exposes legacy shape', async () => {
    const history = {
      totals: {
        inputTokens: 10,
        outputTokens: 5,
        costEstimate: 0.02,
        transactionCount: 1,
      },
      sessions: [],
      projectBreakdown: [],
      backendBreakdown: [],
      daily: [],
    };
    const getTokenHistory = vi.fn().mockResolvedValue(history);
    vi.mocked(useApi).mockReturnValue({ getTokenHistory } as unknown as Api);

    const { result } = renderHook(
      () => useTokenStats({ projectPath: '/repo' }, 0),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getTokenHistory).toHaveBeenCalledWith({ projectPath: '/repo' });
    expect(result.current.data).toEqual(history);
    expect(result.current.error).toBeNull();
  });

  it('loads health status through react-query and exposes refresh', async () => {
    const status = {
      cpu_usage: 12,
      memory_usage: 1024,
      total_memory: 2048,
      threads: 4,
      status: 'Healthy',
      services: [],
      installed_extensions: [],
    };
    vi.mocked(tauriIpc.healthGetStatus).mockResolvedValue(status);

    const { result } = renderHook(() => useHealthStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.status).toEqual(status);
    await result.current.refresh();
    expect(tauriIpc.healthGetStatus).toHaveBeenCalledTimes(2);
  });

  it('loads project intelligence, capability scan, and vector status together', async () => {
    const api = {
      scanProjectIntelligence: vi.fn().mockResolvedValue({ git: {} }),
      projectScan: vi.fn().mockResolvedValue({
        scannedAt: '2026-05-06T00:00:00.000Z',
        totalFileCount: 3,
        scanDurationMs: 4,
      }),
      vectorGetStatus: vi.fn().mockResolvedValue({ indexed: true }),
      projectScanAsync: vi.fn(),
      vectorIndexKnowledge: vi.fn(),
      vectorIndexProject: vi.fn(),
    } as unknown as ExtendedApi;

    const { result } = renderHook(() => useProjectIntelligence(api, '/repo'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(api.scanProjectIntelligence).toHaveBeenCalledWith('/repo');
    expect(api.projectScan).toHaveBeenCalledWith('/repo', {
      includeCliHealth: true,
      includeGitHealth: true,
    });
    expect(api.vectorGetStatus).toHaveBeenCalled();
    expect(result.current.intelligence).toEqual({ git: {} });
    expect(result.current.capabilityScan).toMatchObject({ totalFileCount: 3 });
    expect(result.current.vectorStatus).toEqual({ indexed: true });
  });
});
