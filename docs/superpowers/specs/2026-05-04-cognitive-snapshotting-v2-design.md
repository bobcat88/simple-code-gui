# Cognitive Snapshotting v2

**Date:** 2026-05-04  
**Issue:** simple-code-gui-f8ib  
**Phase:** 38

## Summary

Wire up the stub `<ChevronRight>` buttons in `MemoryVault` to real actions. Clicking a snapshot row expands it to reveal two actions: **Restore Messages** (partial memory restoration via full hydrate) and **Branch Workspace** (point-in-time worktree from snapshot commit).

## Scope

- Expand/collapse snapshot rows in `MemoryVault`
- "Restore Messages" calls `api.gsdHydrateSwarm(projectPath)`
- "Branch Workspace" calls `api.gsdCreateSnapshotWorkspace(snapshot.id)`
- Per-action loading states and inline feedback
- Single file change: `SwarmCognitiveHub.tsx`

Out of scope: new backend IPC, per-snapshot partial hydration, snapshot deletion.

## Architecture

`MemoryVault` is currently a stateless functional component. It gains two pieces of state:

```typescript
const [expandedId, setExpandedId] = useState<string | null>(null);
const [actionState, setActionState] = useState<Record<string, { loading: 'restore' | 'branch' | null; message: string | null }>>({});
```

`expandedId` tracks which snapshot row is open (only one at a time). `actionState` maps `snapshotId → { loading, message }` for per-row feedback.

`MemoryVault` receives a new `projectPath: string` prop (already available in `SwarmCognitiveHub` where it's mounted — just not passed down yet).

### Row interaction

Clicking a row header toggles `expandedId`. When expanded, two action buttons appear below with `animate-in slide-in-from-top-2`:

| Button | Label | Action | IPC |
|--------|-------|--------|-----|
| Restore Messages | `⬇ Restore Messages` | Sets `loading: 'restore'`, calls `gsdHydrateSwarm(projectPath)` | `api.gsdHydrateSwarm` |
| Branch Workspace | `⎇ Branch Workspace` | Sets `loading: 'branch'`, calls `gsdCreateSnapshotWorkspace(snapshot.id)` | `api.gsdCreateSnapshotWorkspace` |

On success: show message for 3s then clear. On error: show error message for 3s then clear.

### `<ChevronRight>` → animated chevron

The static `<ChevronRight>` becomes `<ChevronDown>` when expanded, `<ChevronRight>` when collapsed, with `transition-transform duration-200`.

## Component signature

```typescript
const MemoryVault: React.FC<{
  snapshots: SwarmSnapshot[];
  onRefresh: () => void;
  api: ExtendedApi;
  projectPath: string;        // NEW
}>
```

`SwarmCognitiveHub` already has `projectPath` prop — pass it to `<MemoryVault>`.

## Styling

Follows Toxic Glow aesthetic:
- Restore button: `bg-codex-neon/10 text-codex-neon border-codex-neon/30 hover:bg-codex-neon/20`
- Branch button: `bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20`
- Feedback text: `text-[8px] text-codex-neon/60` (success) / `text-red-400` (error)
- Expanded row: `border-codex-neon/20 bg-codex-neon/5`

## Error handling

Both IPC calls are wrapped in try/catch. Errors set `message` to the error string. Loading is cleared in `finally`. `gsdCreateSnapshotWorkspace` success shows `path` from result. `gsdHydrateSwarm` success shows `Restored ${result.count} messages`.

## Testing

- Clicking a row sets `expandedId` to that snapshot's id
- Clicking same row again collapses it
- Clicking a different row switches expansion to the new row
- "Restore Messages" calls `gsdHydrateSwarm` with correct `projectPath`
- "Branch Workspace" calls `gsdCreateSnapshotWorkspace` with correct `snapshotId`
- Success message shown after restore completes
- Error message shown when IPC fails
- Loading state disables button during IPC call
