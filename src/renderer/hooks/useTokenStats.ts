import { useState, useEffect, useCallback } from 'react';
import { useApi } from '../contexts/ApiContext';
import { TokenHistoryResponse, TokenHistoryFilters } from '../api/types';

export function useTokenStats(filters?: TokenHistoryFilters, pollingInterval = 30000) {
  const api = useApi();
  const [data, setData] = useState<TokenHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!api.getTokenHistory) return;
    
    try {
      const history = await api.getTokenHistory(filters);
      setData(history);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch token history:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [api, filters]);

  useEffect(() => {
    fetchStats();
    
    if (pollingInterval > 0) {
      const interval = setInterval(fetchStats, pollingInterval);
      return () => clearInterval(interval);
    }
  }, [fetchStats, pollingInterval]);

  return { data, loading, error, refetch: fetchStats };
}
