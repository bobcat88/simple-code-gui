# Cognitive Snapshotting v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the stub snapshot rows in `MemoryVault` so clicking a row expands it to reveal "Restore Messages" and "Branch Workspace" actions.

**Architecture:** `MemoryVault` (currently stateless) gains `expandedId` and `actionState` local state. It receives a new `projectPath` prop threaded from `SwarmCognitiveHub`. Two actions: restore calls `gsdHydrateSwarm(projectPath)`, branch calls `gsdCreateSnapshotWorkspace(snapshot.id)`. Both show inline loading + feedback.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 4, Vitest, `@testing-library/react`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/renderer/components/intelligence/SwarmCognitiveHub.tsx` | Add `projectPath` to `MemoryVault` call; add `ChevronDown` import; implement stateful `MemoryVault` |
| Create | `src/renderer/components/intelligence/MemoryVault.test.tsx` | Component tests |

---

## Task 1: Implement stateful `MemoryVault` with expand/collapse and actions

**Files:**
- Modify: `src/renderer/components/intelligence/SwarmCognitiveHub.tsx`
- Create: `src/renderer/components/intelligence/MemoryVault.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `src/renderer/components/intelligence/MemoryVault.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryVault } from './SwarmCognitiveHub';
import type { ExtendedApi, SwarmSnapshot } from '../../api/types';

const makeSnapshot = (id: string, name: string): SwarmSnapshot => ({
  id,
  project_path: '/proj',
  name,
  commit_sha: 'abc1234',
  snapshot_path: '/snaps/' + id,
  timestamp: Date.now() - 3600000,
});

const makeApi = (overrides: Partial<ExtendedApi> = {}): ExtendedApi => ({
  gsdHydrateSwarm: vi.fn(() => Promise.resolve({ success: true, count: 5 })),
  gsdCreateSnapshotWorkspace: vi.fn(() => Promise.resolve({ success: true, path: '/ws/abc' })),
  ...overrides,
} as unknown as ExtendedApi);

const snapshots = [makeSnapshot('s1', 'snap-alpha'), makeSnapshot('s2', 'snap-beta')];

describe('MemoryVault', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('renders snapshot names', () => {
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={makeApi()} projectPath="/proj" />);
    expect(screen.getByText('snap-alpha')).toBeInTheDocument();
    expect(screen.getByText('snap-beta')).toBeInTheDocument();
  });

  it('action buttons hidden by default', () => {
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={makeApi()} projectPath="/proj" />);
    expect(screen.queryByText(/restore messages/i)).not.toBeInTheDocument();
  });

  it('clicking row expands action buttons', () => {
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={makeApi()} projectPath="/proj" />);
    fireEvent.click(screen.getByText('snap-alpha'));
    expect(screen.getByText(/restore messages/i)).toBeInTheDocument();
    expect(screen.getByText(/branch workspace/i)).toBeInTheDocument();
  });

  it('clicking same row again collapses it', () => {
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={makeApi()} projectPath="/proj" />);
    fireEvent.click(screen.getByText('snap-alpha'));
    fireEvent.click(screen.getByText('snap-alpha'));
    expect(screen.queryByText(/restore messages/i)).not.toBeInTheDocument();
  });

  it('clicking different row switches expansion', () => {
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={makeApi()} projectPath="/proj" />);
    fireEvent.click(screen.getByText('snap-alpha'));
    fireEvent.click(screen.getByText('snap-beta'));
    // Only one set of action buttons visible
    expect(screen.getAllByText(/restore messages/i)).toHaveLength(1);
  });

  it('Restore Messages calls gsdHydrateSwarm with projectPath', async () => {
    const api = makeApi();
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={api} projectPath="/proj" />);
    fireEvent.click(screen.getByText('snap-alpha'));
    fireEvent.click(screen.getByText(/restore messages/i));
    await waitFor(() => expect(api.gsdHydrateSwarm).toHaveBeenCalledWith('/proj'));
  });

  it('Branch Workspace calls gsdCreateSnapshotWorkspace with snapshotId', async () => {
    const api = makeApi();
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={api} projectPath="/proj" />);
    fireEvent.click(screen.getByText('snap-alpha'));
    fireEvent.click(screen.getByText(/branch workspace/i));
    await waitFor(() => expect(api.gsdCreateSnapshotWorkspace).toHaveBeenCalledWith('s1'));
  });

  it('shows success message after restore', async () => {
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={makeApi()} projectPath="/proj" />);
    fireEvent.click(screen.getByText('snap-alpha'));
    fireEvent.click(screen.getByText(/restore messages/i));
    await waitFor(() => expect(screen.getByText(/restored 5 messages/i)).toBeInTheDocument());
  });

  it('shows success message after branch', async () => {
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={makeApi()} projectPath="/proj" />);
    fireEvent.click(screen.getByText('snap-alpha'));
    fireEvent.click(screen.getByText(/branch workspace/i));
    await waitFor(() => expect(screen.getByText(/workspace isolated/i)).toBeInTheDocument());
  });

  it('shows error message when restore fails', async () => {
    const api = makeApi({
      gsdHydrateSwarm: vi.fn(() => Promise.reject(new Error('Network error'))),
    });
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={api} projectPath="/proj" />);
    fireEvent.click(screen.getByText('snap-alpha'));
    fireEvent.click(screen.getByText(/restore messages/i));
    await waitFor(() => expect(screen.getByText(/network error/i)).toBeInTheDocument());
  });

  it('restore button disabled while loading', async () => {
    let resolveHydrate: () => void;
    const api = makeApi({
      gsdHydrateSwarm: vi.fn(() => new Promise((resolve) => { resolveHydrate = () => resolve({ success: true, count: 0 }); })),
    });
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={api} projectPath="/proj" />);
    fireEvent.click(screen.getByText('snap-alpha'));
    fireEvent.click(screen.getByText(/restore messages/i));
    const btn = screen.getByRole('button', { name: /restore/i });
    expect(btn).toBeDisabled();
    resolveHydrate!();
  });

  it('shows empty state when no snapshots', () => {
    render(<MemoryVault snapshots={[]} onRefresh={vi.fn()} api={makeApi()} projectPath="/proj" />);
    expect(screen.getByText(/no neural footprints/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm fail**

```bash
rtk bun vitest run src/renderer/components/intelligence/MemoryVault.test.tsx
```

Expected: FAIL — `MemoryVault` not exported from `SwarmCognitiveHub`.

- [ ] **Step 3: Implement stateful `MemoryVault` in `SwarmCognitiveHub.tsx`**

**3a.** Add `ChevronDown` to lucide imports (line 2):

```typescript
import {
  Brain, Zap, History, Shield, Activity, Share2, Layers,
  ChevronRight, ChevronDown, Download, Camera, CheckCircle2,
  TrendingUp, TrendingDown, Minus
} from 'lucide-react';
```

**3b.** Replace the current `MemoryVault` const (starting at `const MemoryVault: React.FC<{...}>`) with this exported stateful version:

```typescript
export const MemoryVault: React.FC<{
  snapshots: SwarmSnapshot[];
  onRefresh: () => void;
  api: ExtendedApi;
  projectPath: string;
}> = ({ snapshots, onRefresh, api, projectPath }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionState, setActionState] = useState<
    Record<string, { loading: 'restore' | 'branch' | null; message: string | null; isError: boolean }>
  >({});

  const getState = (id: string) =>
    actionState[id] ?? { loading: null, message: null, isError: false };

  const setLoading = (id: string, loading: 'restore' | 'branch' | null) =>
    setActionState((prev) => ({ ...prev, [id]: { ...getState(id), loading } }));

  const setMessage = (id: string, message: string | null, isError = false) => {
    setActionState((prev) => ({ ...prev, [id]: { ...getState(id), loading: null, message, isError } }));
    if (message) setTimeout(() => setActionState((prev) => ({ ...prev, [id]: { ...getState(id), message: null, isError: false } })), 3000);
  };

  const handleRestore = async (snapshot: SwarmSnapshot) => {
    setLoading(snapshot.id, 'restore');
    try {
      const result = await api.gsdHydrateSwarm(projectPath);
      if (result.success) setMessage(snapshot.id, `Restored ${result.count} messages`);
      else setMessage(snapshot.id, result.error ?? 'Restore failed', true);
    } catch (err) {
      setMessage(snapshot.id, err instanceof Error ? err.message : String(err), true);
    }
  };

  const handleBranch = async (snapshot: SwarmSnapshot) => {
    setLoading(snapshot.id, 'branch');
    try {
      const result = await api.gsdCreateSnapshotWorkspace(snapshot.id);
      if (result.success) setMessage(snapshot.id, `Workspace isolated at: ${result.path}`);
      else setMessage(snapshot.id, result.error ?? 'Branch failed', true);
    } catch (err) {
      setMessage(snapshot.id, err instanceof Error ? err.message : String(err), true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-codex-neon" />
          <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Cognitive Backups</span>
        </div>
        <button onClick={onRefresh} className="text-[9px] font-bold text-codex-neon/60 hover:text-codex-neon uppercase">
          Refresh Vault
        </button>
      </div>

      <div className="space-y-2">
        {snapshots.length === 0 ? (
          <div className="py-20 text-center opacity-20 space-y-4">
            <History size={48} className="mx-auto" />
            <p className="text-[10px] font-bold uppercase tracking-widest">No neural footprints detected</p>
          </div>
        ) : (
          snapshots.map((snapshot) => {
            const isExpanded = expandedId === snapshot.id;
            const state = getState(snapshot.id);
            return (
              <div
                key={snapshot.id}
                className={cn(
                  'rounded-xl border transition-all relative overflow-hidden',
                  isExpanded
                    ? 'bg-codex-neon/5 border-codex-neon/20'
                    : 'bg-white/5 border-white/5 hover:border-codex-neon/30'
                )}
              >
                {/* Row header — clickable */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : snapshot.id)}
                  className="w-full flex items-center justify-between p-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-codex-neon/10 border border-codex-neon/20">
                      <Layers size={14} className="text-codex-neon" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white/90 uppercase tracking-tight">{snapshot.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-white/30 font-mono">@{snapshot.commit_sha?.substring(0, 7)}</span>
                        <span className="text-white/10">•</span>
                        <span className="text-[9px] text-white/30 italic">
                          {formatDistanceToNow(new Date(snapshot.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isExpanded
                    ? <ChevronDown size={16} className="text-codex-neon/60 transition-transform duration-200" />
                    : <ChevronRight size={16} className="text-white/40 transition-transform duration-200" />
                  }
                </button>

                {/* Expanded actions */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
                    {state.message && (
                      <p className={cn('text-[8px] px-1', state.isError ? 'text-red-400' : 'text-codex-neon/60')}>
                        {state.message}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        aria-label="Restore Messages"
                        onClick={() => handleRestore(snapshot)}
                        disabled={state.loading !== null}
                        className={cn(
                          'flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all',
                          'bg-codex-neon/10 text-codex-neon border-codex-neon/30 hover:bg-codex-neon/20',
                          state.loading !== null && 'opacity-40 cursor-not-allowed'
                        )}
                      >
                        {state.loading === 'restore' ? '…' : '⬇ Restore Messages'}
                      </button>
                      <button
                        aria-label="Branch Workspace"
                        onClick={() => handleBranch(snapshot)}
                        disabled={state.loading !== null}
                        className={cn(
                          'flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all',
                          'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20',
                          state.loading !== null && 'opacity-40 cursor-not-allowed'
                        )}
                      >
                        {state.loading === 'branch' ? '…' : '⎇ Branch Workspace'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
```

**3c.** Pass `projectPath` to `<MemoryVault>` at line 90:

```tsx
<MemoryVault snapshots={snapshots} onRefresh={refreshSnapshots} api={api} projectPath={projectPath} />
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
rtk bun vitest run src/renderer/components/intelligence/MemoryVault.test.tsx
```

Expected: all 11 tests PASS.

- [ ] **Step 5: Type-check**

```bash
rtk tsc --noEmit 2>&1 | grep "SwarmCognitiveHub\|MemoryVault" | head -10
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
rtk git add src/renderer/components/intelligence/SwarmCognitiveHub.tsx src/renderer/components/intelligence/MemoryVault.test.tsx
rtk git commit -m "feat: implement Cognitive Snapshotting v2 — expand rows with restore + branch actions"
```

---

## Task 2: Close beads + push

- [ ] **Step 1: Run all tests**

```bash
rtk bun vitest run src/renderer/components/intelligence/MemoryVault.test.tsx
```

Expected: 11/11 PASS.

- [ ] **Step 2: Close beads issue**

```bash
bd close simple-code-gui-f8ib --reason="MemoryVault snapshot rows now expand with Restore Messages + Branch Workspace actions; 11 tests"
```

- [ ] **Step 3: Push**

```bash
rtk git pull --rebase
bd dolt push
rtk git push
```
