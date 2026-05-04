# Synaptic Feedback Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract thought-chain event logic from `NeuralHUDTab` into a stable `useThoughtChain` hook, fixing subscription churn and a state-mutation bug that together caused >100ms latency and silent event loss.

**Architecture:** A new `useThoughtChain(api, nodes)` hook owns subscriptions, history, and highlight state. It uses a `useRef` to track the latest `nodes` without making them an effect dependency, so subscriptions never re-create. `NeuralHUDTab` becomes a thin consumer. The `Node` interface is exported from `NeuralHUDTab.tsx` so the hook can import it.

**Tech Stack:** React 18, TypeScript, Vitest, `@testing-library/react`, Tauri event IPC

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/renderer/components/intelligence/NeuralHUDTab.tsx` | Export `Node`; remove event block; consume hook |
| Create | `src/renderer/hooks/useThoughtChain.ts` | Stable subscriptions, thought/highlight state |
| Create | `src/renderer/hooks/useThoughtChain.test.ts` | Hook unit tests |

---

## Task 1: Export `Node` from `NeuralHUDTab` and stub `useThoughtChain` call

**Files:**
- Modify: `src/renderer/components/intelligence/NeuralHUDTab.tsx:21-27`

The `Node` interface is currently `interface Node { ... }` (private). The new hook needs to import it. Export it and add a placeholder call so the file compiles once the hook exists.

- [ ] **Step 1: Export the Node interface**

In `src/renderer/components/intelligence/NeuralHUDTab.tsx`, change line 21:

```typescript
// Before
interface Node {
  id: string
  name: string
  type: string
  val: number
  color: string
}

// After
export interface Node {
  id: string
  name: string
  type: string
  val: number
  color: string
}
```

- [ ] **Step 2: Type-check compiles cleanly (no new errors)**

```bash
rtk tsc --noEmit 2>&1 | grep "NeuralHUDTab" | head -10
```

Expected: no errors referencing `NeuralHUDTab.tsx`.

- [ ] **Step 3: Commit**

```bash
rtk git add src/renderer/components/intelligence/NeuralHUDTab.tsx
rtk git commit -m "refactor: export Node interface from NeuralHUDTab for useThoughtChain"
```

---

## Task 2: `useThoughtChain` hook

**Files:**
- Create: `src/renderer/hooks/useThoughtChain.ts`
- Create: `src/renderer/hooks/useThoughtChain.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/renderer/hooks/useThoughtChain.test.ts`:

```typescript
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
  onGsdExecutionEvent: vi.fn(() => Promise.resolve(() => {})),
  onGsdSyncEvent: vi.fn(() => Promise.resolve(() => {})),
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

  it('unsubscribes on unmount', async () => {
    const unsub = vi.fn();
    const api = makeApi({
      onGsdExecutionEvent: vi.fn(() => Promise.resolve(unsub)),
    });
    const { unmount } = renderHook(() => useThoughtChain(api, nodes));
    await act(async () => {});
    unmount();
    await act(async () => {});
    expect(unsub).toHaveBeenCalledOnce();
  });

  it('adds incoming events to thoughtHistory newest first', async () => {
    let trigger: (e: GsdExecutionEvent) => void = () => {};
    const api = makeApi({
      onGsdExecutionEvent: vi.fn((cb) => { trigger = cb; return Promise.resolve(() => {}); }),
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
      onGsdExecutionEvent: vi.fn((cb) => { trigger = cb; return Promise.resolve(() => {}); }),
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
      onGsdExecutionEvent: vi.fn((cb) => { trigger = cb; return Promise.resolve(() => {}); }),
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
      onGsdExecutionEvent: vi.fn((cb) => { trigger = cb; return Promise.resolve(() => {}); }),
    });
    const { result } = renderHook(() => useThoughtChain(api, nodes));
    await act(async () => { trigger(makeEvent('database migration running')); });
    expect(result.current.highlightNodes.has('n2')).toBe(true);
    expect(result.current.highlightNodes.has('n1')).toBe(false);
  });

  it('activeThought clears after 5000ms', async () => {
    let trigger: (e: GsdExecutionEvent) => void = () => {};
    const api = makeApi({
      onGsdExecutionEvent: vi.fn((cb) => { trigger = cb; return Promise.resolve(() => {}); }),
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
      onGsdSyncEvent: vi.fn((cb) => { triggerSync = cb; return Promise.resolve(() => {}); }),
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
      onGsdExecutionEvent: vi.fn((cb) => { trigger = cb; subscribeCount.n++; return Promise.resolve(() => {}); }),
    });
    const initialNodes: Node[] = [];
    const { result, rerender } = renderHook(
      ({ ns }) => useThoughtChain(api, ns),
      { initialProps: { ns: initialNodes } }
    );
    // Update nodes — should NOT cause re-subscribe
    rerender({ ns: nodes });
    expect(subscribeCount.n).toBe(1);
    // But matching should use the new nodes
    await act(async () => { trigger(makeEvent('authservice check')); });
    expect(result.current.highlightNodes.has('n1')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
rtk bun vitest run src/renderer/hooks/useThoughtChain.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `useThoughtChain`**

Create `src/renderer/hooks/useThoughtChain.ts`:

```typescript
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
    const unsubExecution = api.onGsdExecutionEvent(handleExecutionEvent);

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
      : Promise.resolve(() => {});

    return () => {
      unsubExecution.then((fn) => fn());
      unsubSync.then((fn) => fn());
    };
  }, [api, handleExecutionEvent]);

  return { thoughtHistory, activeThought, highlightNodes };
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
rtk bun vitest run src/renderer/hooks/useThoughtChain.test.ts
```

Expected: all 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/renderer/hooks/useThoughtChain.ts src/renderer/hooks/useThoughtChain.test.ts
rtk git commit -m "feat: add useThoughtChain hook with stable subscriptions"
```

---

## Task 3: Migrate `NeuralHUDTab` to consume `useThoughtChain`

**Files:**
- Modify: `src/renderer/components/intelligence/NeuralHUDTab.tsx`

Remove the buggy event subscription block and replace with the hook call. Remove the three local state declarations that the hook now owns.

- [ ] **Step 1: Add import**

At the top of `src/renderer/components/intelligence/NeuralHUDTab.tsx`, add after existing imports:

```typescript
import { useThoughtChain } from '../../hooks/useThoughtChain';
```

- [ ] **Step 2: Remove the three owned state declarations**

Remove these three lines from the state declarations section (~lines 52–54):

```typescript
// REMOVE these lines:
const [activeThought, setActiveThought] = useState<{ message: string, nodeIds: string[] } | null>(null)
const [thoughtHistory, setThoughtHistory] = useState<any[]>([])
const [highlightNodes, setHighlightNodes] = useState(new Set())
```

- [ ] **Step 3: Add hook call**

After the `fetchGraphData` useCallback and before the first `useEffect`, add:

```typescript
const { thoughtHistory, activeThought, highlightNodes } = useThoughtChain(api, graphData.nodes);
```

- [ ] **Step 4: Remove the event subscription useEffect block**

Remove lines 103–173 (the entire `useEffect` that contains `fetchGraphData()`, `gsdQuantumSyncStart`, `onGsdExecutionEvent`, and `onGsdSyncEvent`). Replace it with a single focused effect for just `fetchGraphData` and the quantum sync start:

```typescript
useEffect(() => {
  fetchGraphData();
  if (api.gsdQuantumSyncStart) {
    api.gsdQuantumSyncStart().catch((err) =>
      console.error('Failed to start quantum sync:', err)
    );
  }
}, [fetchGraphData, api]);
```

- [ ] **Step 5: Type-check**

```bash
rtk tsc --noEmit 2>&1 | grep "NeuralHUDTab\|useThoughtChain" | head -20
```

Expected: no errors in either file.

- [ ] **Step 6: Commit**

```bash
rtk git add src/renderer/components/intelligence/NeuralHUDTab.tsx
rtk git commit -m "refactor: migrate NeuralHUDTab to useThoughtChain, fix subscription churn"
```

---

## Task 4: Full test run + beads close

- [ ] **Step 1: Run all affected tests**

```bash
rtk bun vitest run src/renderer/hooks/useThoughtChain.test.ts
```

Expected: all 9 tests PASS.

- [ ] **Step 2: Close beads issue**

```bash
bd close simple-code-gui-hxwc --reason="useThoughtChain hook eliminates subscription churn and state mutation bug; 9 tests"
```

- [ ] **Step 3: Push**

```bash
rtk git pull --rebase
bd dolt push
rtk git push
```
