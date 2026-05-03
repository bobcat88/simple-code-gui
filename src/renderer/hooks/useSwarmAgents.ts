import { useState, useEffect, useCallback } from 'react';
import { tauriIpc } from '../lib/tauri-ipc';
import type { Agent } from './useAgentBoard';
import type { BackendId } from '../api/types';

export interface PendingSelection {
  provider: BackendId;
  model: string;
}

export function useSwarmAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pending, setPendingMap] = useState<Record<string, PendingSelection>>({});
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  useEffect(() => {
    tauriIpc.agentList().then(setAgents).catch(console.error);

    const unsub = tauriIpc.onAgentStatusChanged((data) => {
      setAgents((prev) =>
        prev.map((a) => (a.id === data.id ? { ...a, status: data.status } : a))
      );
    });

    return () => { unsub.then((fn) => fn()); };
  }, []);

  const setPending = useCallback((agentId: string, selection: PendingSelection) => {
    setPendingMap((prev) => ({ ...prev, [agentId]: selection }));
  }, []);

  const hasChanges = agents.some((a) => {
    const p = pending[a.id];
    return p !== undefined && p.provider !== a.provider;
  });

  const applyChanges = useCallback(async () => {
    setApplyError(null);
    setApplying(true);
    try {
      const changed = agents.filter((a) => {
        const p = pending[a.id];
        return p !== undefined && p.provider !== a.provider;
      });
      await Promise.all(
        changed.map((a) => tauriIpc.setPtyBackend(a.id, pending[a.id].provider))
      );
      const changeMap = new Map(changed.map((a) => [a.id, pending[a.id]]));
      setAgents((prev) =>
        prev.map((a) => {
          const p = changeMap.get(a.id);
          return p ? { ...a, provider: p.provider, model: p.model } : a;
        })
      );
      setPendingMap({});
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
    }
  }, [agents, pending]);

  return { agents, pending, setPending, hasChanges, applyChanges, applying, applyError };
}
