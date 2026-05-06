import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useCallback, useEffect } from 'react';
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

interface AgentBoardData {
  agents: Agent[];
  providerHealth: Record<string, string>;
}

type AgentTraceInput = Partial<AgentTrace> & Record<string, unknown>;

const AGENT_BOARD_QUERY_KEY = ['agent-board'] as const;
const EMPTY_AGENT_BOARD: AgentBoardData = {
  agents: [],
  providerHealth: {},
};

export function useAgentBoard() {
  const queryClient = useQueryClient();

  const refreshBurnRates = useCallback(async () => {
    try {
      await tauriIpc.agentRefreshBurnRates();
    } catch (err) {
      console.error('Failed to refresh burn rates:', err);
    }
  }, []);

  const query = useQuery<AgentBoardData, Error>({
    queryKey: AGENT_BOARD_QUERY_KEY,
    queryFn: async () => {
      await refreshBurnRates();
      const [agents, providerHealth] = await Promise.all([
        tauriIpc.agentList(),
        tauriIpc.aiGetHealthStatus(),
      ]);
      return { agents, providerHealth };
    },
    refetchInterval: 5000,
    retry: 1,
    throwOnError: false,
  });

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const patchAgents = useCallback(
    (patch: (agents: Agent[]) => Agent[]) => {
      queryClient.setQueryData<AgentBoardData>(
        AGENT_BOARD_QUERY_KEY,
        (current) => ({
          ...(current ?? EMPTY_AGENT_BOARD),
          agents: patch(current?.agents ?? []),
        })
      );
    },
    [queryClient]
  );

  useEffect(() => {
    const pStatus = tauriIpc.onAgentStatusChanged((data) => {
      patchAgents((agents) =>
        agents.map((agent) =>
          agent.id === data.id ? { ...agent, status: data.status } : agent
        )
      );
    });

    const pRegistered = tauriIpc.onAgentRegistered((agent) => {
      patchAgents((agents) => {
        if (agents.some((current) => current.id === agent.id)) {
          return agents.map((current) =>
            current.id === agent.id ? agent : current
          );
        }
        return [agent, ...agents];
      });
    });

    const pMetrics = tauriIpc.onAgentMetricsChanged((data) => {
      patchAgents((agents) =>
        agents.map((agent) =>
          agent.id === data.id
            ? {
                ...agent,
                burn_rate: data.burn_rate,
                quality_score: data.quality_score,
                queue_size: data.queue_size,
                active_task: data.active_task,
                evolution_confidence: data.evolution_confidence,
                evolution_status: data.evolution_status,
              }
            : agent
        )
      );
    });

    const pTrace = listen<unknown>('agent-trace-added', (event) => {
      // Trace panels fetch their own details; keep this event visible for now.
      console.log('Trace added:', event.payload);
    });

    return () => {
      pStatus.then((unsub: UnlistenFn) => unsub());
      pRegistered.then((unsub: UnlistenFn) => unsub());
      pMetrics.then((unsub: UnlistenFn) => unsub());
      pTrace.then((unsub: UnlistenFn) => unsub());
    };
  }, [patchAgents]);

  const updateStatus = async (id: string, status: string) => {
    await tauriIpc.agentUpdateStatus(id, status);
    await refresh();
  };

  const cancelTask = async (id: string) => {
    await tauriIpc.agentCancelTask(id);
    await refresh();
  };

  const listTasks = useCallback(async (agentId: string) => {
    return await tauriIpc.agentListTasks(agentId);
  }, []);

  const updateTaskPriority = async (taskId: string, priority: number) => {
    await tauriIpc.agentUpdateTaskPriority(taskId, priority);
  };

  const data = query.data ?? EMPTY_AGENT_BOARD;

  return {
    agents: data.agents,
    providerHealth: data.providerHealth,
    loading: query.isLoading,
    updateStatus,
    cancelTask,
    listTasks,
    updateTaskPriority,
    listTraces: async (agentId: string) =>
      await tauriIpc.agentListTraces(agentId),
    addTrace: async (trace: AgentTraceInput) =>
      await tauriIpc.agentAddTrace(trace),
    refresh,
    refreshBurnRates,
  };
}
