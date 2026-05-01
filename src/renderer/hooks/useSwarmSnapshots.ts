import { useState, useEffect, useCallback } from 'react';
import { SwarmSnapshot } from '../api/types';
import { getApi } from '../api';

export function useSwarmSnapshots(projectPath: string) {
  const [snapshots, setSnapshots] = useState<SwarmSnapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSnapshots = useCallback(async () => {
    if (!projectPath) return;
    setLoading(true);
    setError(null);
    try {
      const api = getApi();
      if (api) {
        const data = await api.gsdGetSwarmSnapshots(projectPath);
        setSnapshots(data);
      }
    } catch (err) {
      console.error('Failed to fetch swarm snapshots:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  return { snapshots, loading, error, refresh: fetchSnapshots };
}
