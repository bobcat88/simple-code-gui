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
  evolution_confidence?: number;
  evolution_status?: string;
}

export interface AgentTask {
  id: string;
  agentId: string;
  title: string;
  description?: string;
  priority: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentTrace {
  id: string;
  agentId: string;
  taskId?: string;
  step_name: string;
  details?: string;
  status: string;
  duration_ms?: number;
  timestamp: string;
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
        active_task: data.active_task,
        evolution_confidence: data.evolution_confidence,
        evolution_status: data.evolution_status
      } : a));
    });

    const pTrace = tauriIpc.listen('agent-trace-added', (event: any) => {
      // In a real app we might want to update a local trace cache
      // For now we'll just let the components re-fetch if they need to
      console.log('Trace added:', event.payload);
    });

    return () => {
      clearInterval(interval);
      pStatus.then(unsub => unsub());
      pRegistered.then(unsub => unsub());
      pMetrics.then(unsub => unsub());
      pTrace.then(unsub => unsub());
    };
  }, [fetchAgents]);

  const updateStatus = async (id: string, status: string) => {
    await tauriIpc.agentUpdateStatus(id, status);
    await fetchAgents();
  };

  const cancelTask = async (id: string) => {
    await tauriIpc.agentCancelTask(id);
    await fetchAgents();
  };

  const listTasks = useCallback(async (agentId: string) => {
    return await tauriIpc.agentListTasks(agentId);
  }, []);

  const updateTaskPriority = async (taskId: string, priority: number) => {
    await tauriIpc.agentUpdateTaskPriority(taskId, priority);
  };

  return { 
    agents, 
    providerHealth, 
    loading, 
    updateStatus, 
    cancelTask, 
    listTasks, 
    updateTaskPriority,
    listTraces: async (agentId: string) => await tauriIpc.agentListTraces(agentId),
    addTrace: async (trace: any) => await tauriIpc.agentAddTrace(trace),
    refresh: fetchAgents, 
    refreshBurnRates 
  };
}
