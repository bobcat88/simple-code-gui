import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useThoughtChain } from './useThoughtChain';
import type { ExtendedApi, GsdExecutionEvent } from '../api/types';
import type { Node } from '../components/intelligence/NeuralHUDTab';

const makeEvent = (message: string, eventType = 'STEP'): GsdExecutionEvent => ({
  planId: 'p1',
  eventType,
  message,
  timestamp: Date.now(),
});

const makeApi = (overrides: Partial<ExtendedApi> = {}): ExtendedApi => ({
  onGsdExecutionEvent: vi.fn(() => () => {}),
  onGsdSyncEvent: vi.fn(() => () => {}),
  ...overrides,
} as unknown as ExtendedApi);

const nodes: Node[] = [
  { id: 'n1', name: 'AuthService', type: 'feature', val: 10, color: '#ccff00' },
  { id: 'n2', name: 'Database', type: 'task', val: 8, color: '#ccff00' },
];

describe('useThoughtChain', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('subscribes to onGsdExecutionEvent on mount', () => {
    const api = makeApi();
    renderHook(() => useThoughtChain(api, nodes));
    expect(api.onGsdExecutionEvent).toHaveBeenCalledOnce();
  });

  it('unsubscribes on unmount', () => {
    const unsub = vi.fn();
    const api = makeApi({
      onGsdExecutionEvent: vi.fn(() => unsub),
    });
    const { unmount } = renderHook(() => useThoughtChain(api, nodes));
    unmount();
    expect(unsub).toHaveBeenCalledOnce();
  });

  it('adds incoming events to thoughtHistory newest first', async () => {
    let trigger: (e: GsdExecutionEvent) => void = () => {};
    const api = makeApi({
      onGsdExecutionEvent: vi.fn((cb) => { trigger = cb; return () => {}; }),
    });
    const { result } = renderHook(() => useThoughtChain(api, nodes));
    await act(async () => { trigger(makeEvent('first')); });
    await act(async () => { trigger(makeEvent('second')); });
    expect(result.current.thoughtHistory[0].message).toBe('second');
    expect(result.current.thoughtHistory[1].message).toBe('first');
  });

  it('caps thoughtHistory at 50 entries', async () => {
    let trigger: (e: GsdExecutionEvent) => void = () => {};
    const api = makeApi({
      onGsdExecutionEvent: vi.fn((cb) => { trigger = cb; return () => {}; }),
    });
    const { result } = renderHook(() => useThoughtChain(api, nodes));
    await act(async () => {
      for (let i = 0; i < 55; i++) trigger(makeEvent(`event ${i}`));
    });
    expect(result.current.thoughtHistory).toHaveLength(50);
  });

  it('sets activeThought with matched nodeIds', async () => {
    let trigger: (e: GsdExecutionEvent) => void = () => {};
    const api = makeApi({
      onGsdExecutionEvent: vi.fn((cb) => { trigger = cb; return () => {}; }),
    });
    const { result } = renderHook(() => useThoughtChain(api, nodes));
    await act(async () => { trigger(makeEvent('authservice is being updated')); });
    expect(result.current.activeThought?.message).toBe('authservice is being updated');
    expect(result.current.activeThought?.nodeIds).toContain('n1');
    expect(result.current.activeThought?.nodeIds).not.toContain('n2');
  });

  it('highlightNodes contains matched node IDs', async () => {
    let trigger: (e: GsdExecutionEvent) => void = () => {};
    const api = makeApi({
      onGsdExecutionEvent: vi.fn((cb) => { trigger = cb; return () => {}; }),
    });
    const { result } = renderHook(() => useThoughtChain(api, nodes));
    await act(async () => { trigger(makeEvent('database migration running')); });
    expect(result.current.highlightNodes.has('n2')).toBe(true);
    expect(result.current.highlightNodes.has('n1')).toBe(false);
  });

  it('activeThought clears after 5000ms', async () => {
    let trigger: (e: GsdExecutionEvent) => void = () => {};
    const api = makeApi({
      onGsdExecutionEvent: vi.fn((cb) => { trigger = cb; return () => {}; }),
    });
    const { result } = renderHook(() => useThoughtChain(api, nodes));
    await act(async () => { trigger(makeEvent('something')); });
    expect(result.current.activeThought).not.toBeNull();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(result.current.activeThought).toBeNull();
  });

  it('sync events add SYNC entry to thoughtHistory', async () => {
    let triggerSync: (e: any) => void = () => {};
    const api = makeApi({
      onGsdSyncEvent: vi.fn((cb) => { triggerSync = cb; return () => {}; }),
    });
    const { result } = renderHook(() => useThoughtChain(api, nodes));
    await act(async () => { triggerSync({ type: 'sync' }); });
    expect(result.current.thoughtHistory[0].eventType).toBe('SYNC');
    expect(result.current.thoughtHistory[0].message).toBe('Synaptic shift detected. Knowledge graph re-synchronized.');
  });

  it('uses latest nodes for matching without re-subscribing', async () => {
    let trigger: (e: GsdExecutionEvent) => void = () => {};
    const subscribeCount = { n: 0 };
    const api = makeApi({
      onGsdExecutionEvent: vi.fn((cb) => { trigger = cb; subscribeCount.n++; return () => {}; }),
    });
    const initialNodes: Node[] = [];
    const { result, rerender } = renderHook(
      ({ ns }) => useThoughtChain(api, ns),
      { initialProps: { ns: initialNodes } }
    );
    rerender({ ns: nodes });
    expect(subscribeCount.n).toBe(1);
    await act(async () => { trigger(makeEvent('authservice check')); });
    expect(result.current.highlightNodes.has('n1')).toBe(true);
  });

  it('highlightNodes is empty when no nodes match', async () => {
    let trigger: (e: GsdExecutionEvent) => void = () => {};
    const api = makeApi({
      onGsdExecutionEvent: vi.fn((cb) => { trigger = cb; return () => {}; }),
    });
    const { result } = renderHook(() => useThoughtChain(api, nodes));
    await act(async () => { trigger(makeEvent('database migration running')); }); // matches n2
    await act(async () => { trigger(makeEvent('something unrelated')); }); // matches nothing
    expect(result.current.highlightNodes.size).toBe(0);
  });
});
