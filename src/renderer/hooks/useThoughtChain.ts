import { useState, useEffect, useRef, useCallback } from 'react';
import type { ExtendedApi, GsdExecutionEvent } from '../api/types';
import type { Node } from '../components/intelligence/NeuralHUDTab';

export interface ThoughtChainState {
  thoughtHistory: GsdExecutionEvent[];
  activeThought: { message: string; nodeIds: string[] } | null;
  highlightNodes: Set<string>;
}

export function useThoughtChain(api: ExtendedApi, nodes: Node[]): ThoughtChainState {
  const [thoughtHistory, setThoughtHistory] = useState<GsdExecutionEvent[]>([]);
  const [activeThought, setActiveThought] = useState<{ message: string; nodeIds: string[] } | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const nodesRef = useRef<Node[]>(nodes);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const handleExecutionEvent = useCallback((event: GsdExecutionEvent) => {
    setThoughtHistory((prev) => [event, ...prev].slice(0, 50));

    const message = event.message.toLowerCase();
    const matched = nodesRef.current
      .filter((n) => message.includes(n.name.toLowerCase()))
      .map((n) => n.id);

    setActiveThought({ message: event.message, nodeIds: matched });
    if (matched.length > 0) {
      setHighlightNodes(new Set(matched));
    }

    setTimeout(() => {
      setActiveThought((current) =>
        current?.message === event.message ? null : current
      );
      setHighlightNodes(new Set());
    }, 5000);
  }, []);

  useEffect(() => {
    const unsubExecution = (api.onGsdExecutionEvent as unknown as (cb: (event: GsdExecutionEvent) => void) => Promise<() => void>)(handleExecutionEvent);

    const unsubSync = api.onGsdSyncEvent
      ? (api.onGsdSyncEvent as unknown as (cb: (event: any) => void) => Promise<() => void>)(() => {
          setThoughtHistory((prev) =>
            [
              {
                planId: '',
                eventType: 'SYNC',
                message: 'Synaptic shift detected. Knowledge graph re-synchronized.',
                timestamp: Date.now(),
              } as GsdExecutionEvent,
              ...prev,
            ].slice(0, 50)
          );
        })
      : Promise.resolve(() => {});

    return () => {
      unsubExecution.then((fn) => fn());
      unsubSync.then((fn) => fn());
    };
  }, [api, handleExecutionEvent]);

  return { thoughtHistory, activeThought, highlightNodes };
}
