# Multi-Model Orchestration Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a floating per-agent provider/model switcher panel to `SwarmCognitiveHub`, backed by `setPtyBackend` IPC.

**Architecture:** A new `useSwarmAgents` hook fetches the live agent list via `agentList()` and tracks pending provider/model selections. A new `OrchestrationPanel` component renders the floating panel with per-agent rows. `SwarmCognitiveHub` gains a FAB that toggles the panel.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 4, Tauri IPC (`setPtyBackend`, `agentList`, `onAgentStatusChanged`), Vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/renderer/hooks/useSwarmAgents.ts` | Fetch agents, track pending changes, apply via `setPtyBackend` |
| Create | `src/renderer/components/intelligence/OrchestrationPanel.tsx` | FAB + floating panel UI |
| Modify | `src/renderer/components/intelligence/SwarmCognitiveHub.tsx` | Mount `OrchestrationPanel` |
| Create | `src/renderer/hooks/useSwarmAgents.test.ts` | Hook unit tests |
| Create | `src/renderer/components/intelligence/OrchestrationPanel.test.tsx` | Panel unit tests |

---

## Task 1: `useSwarmAgents` hook

**Files:**
- Create: `src/renderer/hooks/useSwarmAgents.ts`
- Create: `src/renderer/hooks/useSwarmAgents.test.ts`

The hook loads agents from `agentList()`, subscribes to `onAgentStatusChanged` for live updates, and manages a `pending` map of unsaved provider/model selections. It exposes `applyChanges()` which calls `setPtyBackend` for every agent whose pending provider differs from its current provider.

- [ ] **Step 1: Write failing tests**

Create `src/renderer/hooks/useSwarmAgents.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSwarmAgents } from './useSwarmAgents';
import { tauriIpc } from '../lib/tauri-ipc';

vi.mock('../lib/tauri-ipc', () => ({
  tauriIpc: {
    agentList: vi.fn(),
    onAgentStatusChanged: vi.fn(() => Promise.resolve(() => {})),
    setPtyBackend: vi.fn(() => Promise.resolve()),
  },
}));

const mockAgents = [
  { id: 'a1', name: 'Alpha', role: 'worker', status: 'active', model: 'opus', provider: 'claude', burn_rate: 0, quality_score: 1, queue_size: 0 },
  { id: 'a2', name: 'Beta',  role: 'worker', status: 'active', model: 'default', provider: 'gemini', burn_rate: 0, quality_score: 1, queue_size: 0 },
];

beforeEach(() => {
  vi.mocked(tauriIpc.agentList).mockResolvedValue(mockAgents);
});

describe('useSwarmAgents', () => {
  it('loads agents from agentList on mount', async () => {
    const { result } = renderHook(() => useSwarmAgents());
    await act(async () => {});
    expect(result.current.agents).toHaveLength(2);
    expect(result.current.agents[0].id).toBe('a1');
  });

  it('setPending updates pending map without touching agents', async () => {
    const { result } = renderHook(() => useSwarmAgents());
    await act(async () => {});
    act(() => { result.current.setPending('a1', { provider: 'gemini', model: 'flash' }); });
    expect(result.current.pending['a1']).toEqual({ provider: 'gemini', model: 'flash' });
    expect(result.current.agents[0].provider).toBe('claude');
  });

  it('applyChanges calls setPtyBackend only for agents with changed provider', async () => {
    const { result } = renderHook(() => useSwarmAgents());
    await act(async () => {});
    act(() => { result.current.setPending('a1', { provider: 'gemini', model: 'flash' }); });
    await act(async () => { await result.current.applyChanges(); });
    expect(tauriIpc.setPtyBackend).toHaveBeenCalledOnce();
    expect(tauriIpc.setPtyBackend).toHaveBeenCalledWith('a1', 'gemini');
  });

  it('applyChanges skips agents where pending provider matches current provider', async () => {
    const { result } = renderHook(() => useSwarmAgents());
    await act(async () => {});
    act(() => { result.current.setPending('a1', { provider: 'claude', model: 'sonnet' }); });
    await act(async () => { await result.current.applyChanges(); });
    expect(tauriIpc.setPtyBackend).not.toHaveBeenCalled();
  });

  it('hasChanges is false when no pending changes differ from current state', async () => {
    const { result } = renderHook(() => useSwarmAgents());
    await act(async () => {});
    expect(result.current.hasChanges).toBe(false);
  });

  it('hasChanges is true when a pending provider differs from current', async () => {
    const { result } = renderHook(() => useSwarmAgents());
    await act(async () => {});
    act(() => { result.current.setPending('a1', { provider: 'codex', model: 'default' }); });
    expect(result.current.hasChanges).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
rtk bun vitest run src/renderer/hooks/useSwarmAgents.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `useSwarmAgents`**

Create `src/renderer/hooks/useSwarmAgents.ts`:

```typescript
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
      setAgents((prev) =>
        prev.map((a) => {
          const p = pending[a.id];
          return p && p.provider !== a.provider ? { ...a, provider: p.provider, model: p.model } : a;
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
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
rtk bun vitest run src/renderer/hooks/useSwarmAgents.test.ts
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/renderer/hooks/useSwarmAgents.ts src/renderer/hooks/useSwarmAgents.test.ts
rtk git commit -m "feat: add useSwarmAgents hook for per-agent provider/model tracking"
```

---

## Task 2: `OrchestrationPanel` component

**Files:**
- Create: `src/renderer/components/intelligence/OrchestrationPanel.tsx`
- Create: `src/renderer/components/intelligence/OrchestrationPanel.test.tsx`

The component renders a FAB (⚙) and the sliding panel. It is self-contained: it uses `useSwarmAgents` internally and renders one row per agent. Provider chips and model chips change dynamically. Apply button is disabled when `hasChanges` is false or `applying` is true.

- [ ] **Step 1: Write failing tests**

Create `src/renderer/components/intelligence/OrchestrationPanel.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrchestrationPanel } from './OrchestrationPanel';
import * as useSwarmAgentsModule from '../../hooks/useSwarmAgents';
import type { BackendId } from '../../api/types';

const mockSetPending = vi.fn();
const mockApplyChanges = vi.fn(() => Promise.resolve());

const baseHook = {
  agents: [
    { id: 'a1', name: 'Alpha', role: 'worker', status: 'active', model: 'opus', provider: 'claude' as BackendId, burn_rate: 0, quality_score: 1, queue_size: 0 },
  ],
  pending: {},
  setPending: mockSetPending,
  hasChanges: false,
  applyChanges: mockApplyChanges,
  applying: false,
  applyError: null,
};

beforeEach(() => {
  vi.spyOn(useSwarmAgentsModule, 'useSwarmAgents').mockReturnValue(baseHook);
  mockSetPending.mockClear();
  mockApplyChanges.mockClear();
});

describe('OrchestrationPanel', () => {
  it('renders FAB button', () => {
    render(<OrchestrationPanel />);
    expect(screen.getByRole('button', { name: /orchestration/i })).toBeInTheDocument();
  });

  it('panel is hidden by default', () => {
    render(<OrchestrationPanel />);
    expect(screen.queryByText('Apply to Swarm')).not.toBeInTheDocument();
  });

  it('panel opens when FAB is clicked', () => {
    render(<OrchestrationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /orchestration/i }));
    expect(screen.getByText('Apply to Swarm')).toBeInTheDocument();
  });

  it('renders agent rows when open', () => {
    render(<OrchestrationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /orchestration/i }));
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('shows claude model chips (opus/sonnet/haiku) when claude provider is active', () => {
    render(<OrchestrationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /orchestration/i }));
    expect(screen.getByText('Opus')).toBeInTheDocument();
    expect(screen.getByText('Sonnet')).toBeInTheDocument();
    expect(screen.getByText('Haiku')).toBeInTheDocument();
  });

  it('clicking a provider chip calls setPending', () => {
    render(<OrchestrationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /orchestration/i }));
    fireEvent.click(screen.getByText('Gemini'));
    expect(mockSetPending).toHaveBeenCalledWith('a1', { provider: 'gemini', model: 'default' });
  });

  it('Apply button is disabled when hasChanges is false', () => {
    render(<OrchestrationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /orchestration/i }));
    const btn = screen.getByText('Apply to Swarm').closest('button');
    expect(btn).toBeDisabled();
  });

  it('Apply button is enabled when hasChanges is true', () => {
    vi.spyOn(useSwarmAgentsModule, 'useSwarmAgents').mockReturnValue({ ...baseHook, hasChanges: true });
    render(<OrchestrationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /orchestration/i }));
    const btn = screen.getByText('Apply to Swarm').closest('button');
    expect(btn).not.toBeDisabled();
  });

  it('Apply button calls applyChanges', async () => {
    vi.spyOn(useSwarmAgentsModule, 'useSwarmAgents').mockReturnValue({ ...baseHook, hasChanges: true });
    render(<OrchestrationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /orchestration/i }));
    fireEvent.click(screen.getByText('Apply to Swarm').closest('button')!);
    await waitFor(() => expect(mockApplyChanges).toHaveBeenCalledOnce());
  });

  it('shows empty state when no agents', () => {
    vi.spyOn(useSwarmAgentsModule, 'useSwarmAgents').mockReturnValue({ ...baseHook, agents: [] });
    render(<OrchestrationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /orchestration/i }));
    expect(screen.getByText(/no active agents/i)).toBeInTheDocument();
  });

  it('shows error message when applyError is set', () => {
    vi.spyOn(useSwarmAgentsModule, 'useSwarmAgents').mockReturnValue({ ...baseHook, applyError: 'Backend unavailable' });
    render(<OrchestrationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /orchestration/i }));
    expect(screen.getByText('Backend unavailable')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
rtk bun vitest run src/renderer/components/intelligence/OrchestrationPanel.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `OrchestrationPanel`**

Create `src/renderer/components/intelligence/OrchestrationPanel.tsx`:

```typescript
import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSwarmAgents } from '../../hooks/useSwarmAgents';
import type { BackendId } from '../../api/types';

const PROVIDER_MODELS: Record<BackendId, string[]> = {
  claude:   ['default', 'opus', 'sonnet', 'haiku'],
  gemini:   ['default', 'pro', 'flash'],
  codex:    ['default'],
  opencode: ['default'],
  aider:    ['default'],
};

const AGENT_COLORS = ['#ccff00', '#ff6b6b', '#7b9cff', '#ffd700', '#ff9ef7'];

export const OrchestrationPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const { agents, pending, setPending, hasChanges, applyChanges, applying, applyError } = useSwarmAgents();

  const getProvider = (agentId: string, currentProvider: string): BackendId =>
    (pending[agentId]?.provider ?? currentProvider) as BackendId;

  const getModel = (agentId: string, currentModel: string): string =>
    pending[agentId]?.model ?? currentModel;

  return (
    <>
      {/* FAB */}
      <button
        aria-label="Orchestration"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'absolute bottom-3 right-3 z-10 flex items-center justify-center',
          'w-7 h-7 rounded-lg bg-black/80 backdrop-blur-md',
          'border transition-all duration-200',
          open
            ? 'border-codex-neon/60 text-codex-neon shadow-[0_0_12px_rgba(204,255,0,0.2)]'
            : 'border-white/10 text-white/40 hover:border-codex-neon/40 hover:text-codex-neon/70'
        )}
      >
        <Settings size={13} />
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute inset-y-0 right-0 w-52 z-20 flex flex-col bg-black/95 backdrop-blur-xl border-l border-codex-neon/25 shadow-[-8px_0_32px_rgba(204,255,0,0.07)] animate-in slide-in-from-right-4 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/5">
            <span className="text-[9px] font-black uppercase tracking-widest text-codex-neon">
              ⚙ Orchestration
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-white/30 hover:text-white/60 transition-colors text-xs leading-none"
            >
              ✕
            </button>
          </div>

          {/* Agent list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {agents.length === 0 ? (
              <div className="py-12 text-center opacity-30 space-y-2">
                <p className="text-[9px] font-bold uppercase tracking-widest">No active agents detected</p>
              </div>
            ) : (
              agents.map((agent, idx) => {
                const activeProvider = getProvider(agent.id, agent.provider);
                const activeModel = getModel(agent.id, agent.model);
                const models = PROVIDER_MODELS[activeProvider] ?? ['default'];
                const dotColor = AGENT_COLORS[idx % AGENT_COLORS.length];

                return (
                  <div
                    key={agent.id}
                    className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-2"
                  >
                    {/* Agent name */}
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
                      />
                      <span className="text-[9px] font-black uppercase tracking-tight text-white/80">
                        {agent.name}
                      </span>
                    </div>

                    {/* Provider chips */}
                    <div>
                      <div className="text-[7px] font-bold uppercase tracking-widest text-white/25 mb-1">Provider</div>
                      <div className="flex flex-wrap gap-1">
                        {(Object.keys(PROVIDER_MODELS) as BackendId[]).map((p) => (
                          <button
                            key={p}
                            onClick={() => setPending(agent.id, { provider: p, model: 'default' })}
                            className={cn(
                              'text-[7px] font-800 uppercase px-1.5 py-0.5 rounded transition-all',
                              activeProvider === p
                                ? 'bg-codex-neon/15 text-codex-neon border border-codex-neon/30'
                                : 'bg-white/[0.04] text-white/30 border border-transparent hover:border-white/10'
                            )}
                          >
                            {p.charAt(0).toUpperCase() + p.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Model chips */}
                    <div>
                      <div className="text-[7px] font-bold uppercase tracking-widest text-white/25 mb-1">Model</div>
                      <div className="flex flex-wrap gap-1">
                        {models.map((m) => (
                          <button
                            key={m}
                            onClick={() => setPending(agent.id, { provider: activeProvider, model: m })}
                            className={cn(
                              'text-[7px] font-800 uppercase px-1.5 py-0.5 rounded transition-all',
                              activeModel === m
                                ? 'bg-codex-neon/15 text-codex-neon border border-codex-neon/30'
                                : 'bg-white/[0.04] text-white/30 border border-transparent hover:border-white/10'
                            )}
                          >
                            {m.charAt(0).toUpperCase() + m.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-white/5 space-y-1.5">
            {applyError && (
              <p className="text-[8px] text-red-400 px-1">{applyError}</p>
            )}
            <button
              onClick={applyChanges}
              disabled={!hasChanges || applying}
              className={cn(
                'w-full py-2 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all',
                hasChanges && !applying
                  ? 'bg-codex-neon text-black hover:brightness-110'
                  : 'bg-white/5 text-white/20 cursor-not-allowed'
              )}
            >
              {applying ? 'Applying…' : 'Apply to Swarm'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
rtk bun vitest run src/renderer/components/intelligence/OrchestrationPanel.test.tsx
```

Expected: all 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
rtk git add src/renderer/components/intelligence/OrchestrationPanel.tsx src/renderer/components/intelligence/OrchestrationPanel.test.tsx
rtk git commit -m "feat: add OrchestrationPanel component for per-agent provider/model switching"
```

---

## Task 3: Wire `OrchestrationPanel` into `SwarmCognitiveHub`

**Files:**
- Modify: `src/renderer/components/intelligence/SwarmCognitiveHub.tsx`

The hub's main viewport div already has `relative overflow-hidden` and a `group/hub` class. Mount `OrchestrationPanel` inside that div. Remove the existing stub `ControlButton` for Snapshot/Handoff (they remain but the overlay is now replaced by the real panel).

- [ ] **Step 1: Read the current hub viewport section**

Open `src/renderer/components/intelligence/SwarmCognitiveHub.tsx` and locate the `{/* Global Controls Overlay */}` comment block (around line 90).

- [ ] **Step 2: Add `OrchestrationPanel` import**

At the top of `SwarmCognitiveHub.tsx`, add:

```typescript
import { OrchestrationPanel } from './OrchestrationPanel';
```

- [ ] **Step 3: Mount the panel inside the viewport div**

Inside the `{/* Main Viewport */}` div (the one with `className="flex-1 relative min-h-0 ..."`), add `<OrchestrationPanel />` after the three conditional layer divs and before the `{/* Global Controls Overlay */}` block:

```tsx
{/* Orchestration Controls */}
<OrchestrationPanel />
```

The existing `{/* Global Controls Overlay */}` block with the Camera/Share2 stub buttons can remain — they are separate actions and don't conflict.

- [ ] **Step 4: Type-check**

```bash
rtk tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
rtk git add src/renderer/components/intelligence/SwarmCognitiveHub.tsx
rtk git commit -m "feat: wire OrchestrationPanel into SwarmCognitiveHub"
```

---

## Task 4: Full test run + beads close

- [ ] **Step 1: Run all affected tests**

```bash
rtk bun vitest run src/renderer/hooks/useSwarmAgents.test.ts src/renderer/components/intelligence/OrchestrationPanel.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 2: Close beads issue**

```bash
bd close simple-code-gui-5ywo --reason="OrchestrationPanel with per-agent provider/model switching implemented and tested"
```

- [ ] **Step 3: Push**

```bash
rtk git pull --rebase
bd dolt push
rtk git push
```
