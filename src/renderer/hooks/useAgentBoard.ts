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
  queue_size: number;
  active_task?: string;
}

export function useAgentBoard() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [providerHealth, setProviderHealth] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const refreshBurnRates = useCallback(async () => {
    try {
      await tauriIpc.agentRefreshBurnRates();
    } catch (err) {
      console.error('Failed to refresh burn rates:', err);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      await refreshBurnRates();
      const [list, health] = await Promise.all([
        tauriIpc.agentList(),
        tauriIpc.aiGetHealthStatus()
      ]);
      setAgents(list);
      setProviderHealth(health);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setLoading(false);
    }
  }, [refreshBurnRates]);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000); // Update every 5s
    
    const pStatus = tauriIpc.onAgentStatusChanged((data) => {
      setAgents(prev => prev.map(a => a.id === data.id ? { ...a, status: data.status } : a));
    });

    const pRegistered = tauriIpc.onAgentRegistered((agent) => {
      setAgents(prev => {
        if (prev.some(a => a.id === agent.id)) {
          return prev.map(a => a.id === agent.id ? agent : a);
        }
        return [agent, ...prev];
      });
    });
    
    const pMetrics = tauriIpc.onAgentMetricsChanged((data) => {
      setAgents(prev => prev.map(a => a.id === data.id ? { 
        ...a, 
        burn_rate: data.burn_rate,
        quality_score: data.quality_score,
        queue_size: data.queue_size,
        active_task: data.active_task
      } : a));
    });

    return () => {
      clearInterval(interval);
      pStatus.then(unsub => unsub());
      pRegistered.then(unsub => unsub());
      pMetrics.then(unsub => unsub());
    };
  }, [fetchAgents]);

  const updateStatus = async (id: string, status: string) => {
    await tauriIpc.agentUpdateStatus(id, status);
    await fetchAgents();
  };

  return { agents, providerHealth, loading, updateStatus, refresh: fetchAgents, refreshBurnRates };
}
