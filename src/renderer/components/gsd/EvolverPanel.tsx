import React, { useState, useEffect } from 'react';
import { Dna, Zap, TrendingUp, Check, RefreshCw, AlertCircle, Bot } from 'lucide-react';
import type { PersonaEvolutionProposal } from '../../api/intelligence-types';
import { useApi } from '../../contexts/ApiContext';
import { cn } from '../../lib/utils';

export const EvolverPanel: React.FC = () => {
  const { api } = useApi();
  const [proposals, setProposals] = useState<PersonaEvolutionProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);

  const fetchProposals = async () => {
    if (!api.gsdGetPersonaProposals) return;
    setLoading(true);
    try {
      const result = await api.gsdGetPersonaProposals();
      setProposals(result.filter((p: PersonaEvolutionProposal) => p.status === 'PENDING'));
    } catch (error) {
      console.error('Failed to fetch persona proposals:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyEvolution = async (proposalId: string) => {
    if (!api.gsdApplyPersonaEvolution) return;
    setApplying(proposalId);
    try {
      await api.gsdApplyPersonaEvolution(proposalId);
      setProposals(prev => prev.filter(p => p.id !== proposalId));
    } catch (error) {
      console.error('Failed to apply persona evolution:', error);
    } finally {
      setApplying(null);
    }
  };

  useEffect(() => {
    fetchProposals();
    // Poll for new evolution results every 30s
    const interval = setInterval(fetchProposals, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4 p-4 bg-obsidian-dark/50 border border-purple-500/20 rounded-xl borg-glass h-full flex flex-col">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <h3 className="text-sm font-bold text-purple-400 flex items-center gap-2 uppercase tracking-widest">
          <Dna className="w-4 h-4" />
          Shadow Swarm Evolver
        </h3>
        <button 
          onClick={fetchProposals}
          disabled={loading}
          className="p-1 hover:bg-purple-500/10 rounded transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 text-purple-400/60 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
        {loading && proposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Zap className="w-8 h-8 text-purple-500 animate-pulse" />
            <p className="text-[10px] text-purple-400/40 font-mono uppercase tracking-[0.2em]">Simulating mutations...</p>
          </div>
        ) : proposals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-40 grayscale space-y-4">
            <Bot className="w-12 h-12 mx-auto" />
            <p className="text-[10px] font-bold uppercase tracking-widest">No pending evolutions detected</p>
          </div>
        ) : (
          proposals.map(proposal => (
            <div 
              key={proposal.id}
              className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-xl hover:border-purple-400/30 transition-all group"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-tight group-hover:text-purple-400 transition-colors">
                      {proposal.title}
                    </h4>
                    <span className="text-[9px] font-mono text-purple-400/60 uppercase">
                      Target: {proposal.personaId}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <TrendingUp className="w-3 h-3" />
                    <span className="text-sm font-black tabular-nums">+{Math.round(proposal.performanceGain * 100)}%</span>
                  </div>
                  <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Efficiency Gain</span>
                </div>
              </div>

              <p className="text-[10px] text-white/60 leading-relaxed mb-4 italic pl-2 border-l-2 border-purple-500/20">
                "{proposal.rationale}"
              </p>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="p-2 bg-black/40 rounded border border-white/5">
                  <span className="text-[8px] font-black text-white/30 uppercase block mb-1">Mutation</span>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <code className="text-[10px] text-purple-300">{proposal.mutationValue}</code>
                  </div>
                </div>
                <div className="p-2 bg-black/40 rounded border border-white/5">
                  <span className="text-[8px] font-black text-white/30 uppercase block mb-1">Type</span>
                  <span className="text-[10px] text-white/70 font-bold">{proposal.mutationType.replace('_', ' ')}</span>
                </div>
              </div>

              <button
                onClick={() => applyEvolution(proposal.id)}
                disabled={applying === proposal.id}
                className="w-full py-2.5 bg-purple-500 text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-lg hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_0_15px_rgba(168,85,247,0.2)] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {applying === proposal.id ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Promote to Main Swarm
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-start gap-3 shrink-0">
        <AlertCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <p className="text-[9px] text-purple-400/80 leading-relaxed font-bold uppercase tracking-tight">
          Shadow tests are sandboxed dry-runs. Promotion merges the capability into the swarm's live governance policy.
        </p>
      </div>
    </div>
  );
};
