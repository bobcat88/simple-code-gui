import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createElement } from 'react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api } from '../api/types';
import { useApi } from '../contexts/ApiContext';
import { useTokenStats } from './useTokenStats';

vi.mock('../contexts/ApiContext', () => ({
  useApi: vi.fn(),
}));

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => vi.clearAllMocks());

describe('useTokenStats', () => {
  it('returns null data when getTokenHistory is absent from api', async () => {
    vi.mocked(useApi).mockReturnValue({} as unknown as Api);
    const { result } = renderHook(() => useTokenStats(undefined, 0), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('returns fetched data and null error on success', async () => {
    const history = {
      totals: { inputTokens: 10, outputTokens: 5, costEstimate: 0.01, transactionCount: 1 },
      sessions: [],
      projectBreakdown: [],
      backendBreakdown: [],
      daily: [],
    };
    vi.mocked(useApi).mockReturnValue({
      getTokenHistory: vi.fn().mockResolvedValue(history),
    } as unknown as Api);
    const { result } = renderHook(() => useTokenStats({ projectPath: '/x' }, 0), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(history);
    expect(result.current.error).toBeNull();
  });

  it('refetch succeeds and calls getTokenHistory again (covers lines 27-28)', async () => {
    const getTokenHistory = vi.fn().mockResolvedValue(null);
    vi.mocked(useApi).mockReturnValue({ getTokenHistory } as unknown as Api);
    const { result } = renderHook(() => useTokenStats(undefined, 0), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.refetch(); });
    expect(getTokenHistory).toHaveBeenCalledTimes(2);
  });

  it('refetch swallows thrown errors (covers lines 29-30 catch branch)', async () => {
    // First call succeeds, second throws to trigger catch in refetch()
    const getTokenHistory = vi.fn()
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('network error'));
    vi.mocked(useApi).mockReturnValue({ getTokenHistory } as unknown as Api);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result } = renderHook(() => useTokenStats(undefined, 0), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    // Must not throw
    await act(async () => { await result.current.refetch(); });
    consoleSpy.mockRestore();
  });

  it('passes filters to getTokenHistory', async () => {
    const getTokenHistory = vi.fn().mockResolvedValue(null);
    vi.mocked(useApi).mockReturnValue({ getTokenHistory } as unknown as Api);
    const filters = { projectPath: '/proj', since: '2026-01-01' };
    const { result } = renderHook(() => useTokenStats(filters, 0), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getTokenHistory).toHaveBeenCalledWith(filters);
  });
});
