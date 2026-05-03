# Synaptic Feedback Hardening

**Date:** 2026-05-04  
**Issue:** simple-code-gui-hxwc  
**Phase:** 38

## Summary

Extract all thought-chain event logic from `NeuralHUDTab` into a dedicated `useThoughtChain` hook. Fixes two bugs causing event loss and silent render failures, and eliminates subscription churn that was the primary source of >100ms latency.

## Bugs Being Fixed

### Bug 1: Subscription churn via unstable effect deps

`NeuralHUDTab`'s event subscription `useEffect` (line 103) lists `graphData.nodes` as a dependency. Every time graph data updates, the effect tears down both `onGsdExecutionEvent` and `onGsdSyncEvent` subscriptions and re-creates them. During the gap, events are silently dropped.

### Bug 2: State mutation returns same reference

Inside the event handler:
```typescript
setGraphData(current => {
  current.nodes.forEach(node => { ... });  // mutates current
  return current;  // returns same reference → React skips re-render
})
```
This never triggers a re-render. The keyword matching to identify related nodes is effectively a no-op.

## Architecture

### New hook: `useThoughtChain`

```typescript
function useThoughtChain(api: ExtendedApi, nodes: Node[]): ThoughtChainState
```

**Responsibilities:**
- Subscribe to `onGsdExecutionEvent` once, never re-subscribe
- Subscribe to `onGsdSyncEvent` once, never re-subscribe
- Maintain `thoughtHistory` (last 50 events, newest first)
- Maintain `activeThought` (current highlighted event + matched node IDs, auto-clears after 5s)
- Maintain `highlightNodes` (Set of node IDs matching current thought)
- Keyword-match incoming events against `nodes` using a `useRef` that tracks the latest `nodes` value — never a dep

**Stable subscription pattern:**
```typescript
const nodesRef = useRef(nodes);
useEffect(() => { nodesRef.current = nodes; }, [nodes]);  // sync ref, no subscription

useEffect(() => {
  const unsub = api.onGsdExecutionEvent((event) => {
    const matched = nodesRef.current
      .filter(n => event.message.toLowerCase().includes(n.name.toLowerCase()))
      .map(n => n.id);
    // update state ...
  });
  return () => { unsub.then(fn => fn()); };
}, [api]);  // api is stable — no re-subscribe on graph changes
```

**Returns:**
```typescript
interface ThoughtChainState {
  thoughtHistory: GsdExecutionEvent[];
  activeThought: { message: string; nodeIds: string[] } | null;
  highlightNodes: Set<string>;
}
```

### `NeuralHUDTab` changes

Remove the ~70-line event subscription block (lines 103–173). Replace with:

```typescript
const { thoughtHistory, activeThought, highlightNodes } = useThoughtChain(api, graphData.nodes);
```

Remove `thoughtHistory`, `activeThought`, `highlightNodes` state declarations (now owned by hook). Remove the `gsdQuantumSyncStart` call — it belongs in a lifecycle hook, not the event subscription effect. Keep `highlightLinks` in `NeuralHUDTab` (graph-interaction driven, not event driven).

## Files

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/renderer/hooks/useThoughtChain.ts` | Stable subscriptions, thought state |
| Create | `src/renderer/hooks/useThoughtChain.test.ts` | Hook unit tests |
| Modify | `src/renderer/components/intelligence/NeuralHUDTab.tsx` | Remove event block, consume hook |

## Types

`GsdExecutionEvent` is already defined in `src/renderer/api/types.ts`:
```typescript
interface GsdExecutionEvent {
  planId: string;
  phaseId?: string;
  stepId?: string;
  eventType: string;
  message: string;
  timestamp: number;
}
```

`Node` is defined locally in `NeuralHUDTab.tsx` — export it so `useThoughtChain` can import it.

## Testing

`useThoughtChain` tests cover:
1. Subscribes to `onGsdExecutionEvent` on mount, unsubscribes on unmount
2. Adds incoming events to `thoughtHistory` (newest first, max 50)
3. Sets `activeThought` with matched node IDs on event
4. `highlightNodes` contains matched node IDs
5. `activeThought` clears after 5s (fake timers)
6. Sync events (`onGsdSyncEvent`) add a SYNC entry to history
7. Node keyword matching uses latest `nodes` value (nodesRef, not stale closure)
8. No re-subscribe when `nodes` prop changes

## Error Handling

`onGsdSyncEvent` is optional on `ExtendedApi` — already guarded with `api.onGsdSyncEvent ?` in existing code. Preserve that guard.

Subscription cleanup uses `.then(fn => fn())` pattern consistent with rest of codebase.
