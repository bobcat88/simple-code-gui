import { useQuery } from '@tanstack/react-query';
import type { TokenHistoryFilters, TokenHistoryResponse } from '../api/types';
import { useApi } from '../contexts/ApiContext';

export function useTokenStats(
  filters?: TokenHistoryFilters,
  pollingInterval = 30000
) {
  const api = useApi();

  const query = useQuery<TokenHistoryResponse | null, Error>({
    queryKey: ['token-history', filters ?? null],
    queryFn: async () => {
      if (!api.getTokenHistory) return null;
      return await api.getTokenHistory(filters);
    },
    refetchInterval: pollingInterval > 0 ? pollingInterval : false,
    retry: 1,
    throwOnError: false,
  });

  return {
    data: query.data ?? null,
    loading: query.isLoading,
    error: query.error ? query.error.message : null,
    refetch: async () => {
      try {
        await query.refetch();
      } catch (err) {
        console.error('Failed to fetch token history:', err);
      }
    },
  };
}
