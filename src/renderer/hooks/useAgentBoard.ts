import { useState, useEffect, useCallback } from 'react';
import { tauriIpc } from '../lib/tauri-ipc';

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: string;
  last_active?: string;
  model: string;
  provider: string;
  burn_rate: number;
  quality_score: number;
}

export function useAgentBoard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = useCallback(async () => {
    try {
      const list = await tauriIpc.agentList();
      setAgents(list);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000); // Update every 5s
    return () => clearInterval(interval);
  }, [fetchAgents]);

  const updateStatus = async (id: string, status: string) => {
    await tauriIpc.agentUpdateStatus(id, status);
    await fetchAgents();
  };

  return { agents, loading, updateStatus, refresh: fetchAgents };
}
