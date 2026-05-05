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
    setHighlightNodes(new Set(matched));

    setTimeout(() => {
      setActiveThought((current) =>
        current?.message === event.message ? null : current
      );
      setHighlightNodes(new Set());
    }, 5000);
  }, []);

  useEffect(() => {
    const unsubExecution = api.onGsdExecutionEvent
      ? api.onGsdExecutionEvent(handleExecutionEvent)
      : () => {};

    const unsubSync = api.onGsdSyncEvent
      ? api.onGsdSyncEvent(() => {
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
      : () => {};

    const unsubLearning = api.onAiLearningCaptured
      ? api.onAiLearningCaptured((payload) => {
          setThoughtHistory((prev) =>
            [
              {
                planId: '',
                eventType: 'LEARNING',
                message: `Cognitive adjustment captured: ${payload.payload?.action ?? payload.eventType} - ${payload.payload?.feedback ?? ''}`,
                timestamp: Date.now(),
              } as GsdExecutionEvent,
              ...prev,
            ].slice(0, 50)
          );
        })
      : () => {};

    return () => {
      unsubExecution();
      unsubSync();
      unsubLearning();
    };
  }, [api, handleExecutionEvent]);

  return { thoughtHistory, activeThought, highlightNodes };
}
