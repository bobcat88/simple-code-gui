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
              aria-label="Close orchestration panel"
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
                            aria-pressed={activeProvider === p}
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
                            aria-pressed={activeModel === m}
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
