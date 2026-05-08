import React, { useState, useEffect } from 'react';
import { Scale, Users, CheckCircle2, MessageSquare, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import type { ConsensusRound, ConsensusProposal, AgentVote } from '../../api/intelligence-types';
import { useApi } from '../../contexts/ApiContext';
import { cn } from '../../lib/utils';

export const ConsensusPanel: React.FC = () => {
  const api = useApi();
  const [rounds, setRounds] = useState<ConsensusRound[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchRounds = async () => {
    if (!api.gsdGetConsensusRounds) return;
    setLoading(true);
    try {
      const result = await api.gsdGetConsensusRounds();
      setRounds(result);
    } catch (error) {
      console.error('Failed to fetch consensus rounds:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRounds();
    const interval = setInterval(fetchRounds, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4 p-4 bg-obsidian-dark/50 border border-codex-neon/20 rounded-xl borg-glass h-full flex flex-col">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <h3 className="text-sm font-bold text-codex-neon flex items-center gap-2 uppercase tracking-widest">
          <Scale className="w-4 h-4" />
          Swarm Consensus Protocol
        </h3>
        <button 
          onClick={fetchRounds}
          disabled={loading}
          className="p-1 hover:bg-codex-neon/10 rounded transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 text-codex-neon/60 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
        {loading && rounds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-codex-neon/40">
            <Users className="w-8 h-8 animate-pulse" />
            <p className="text-[10px] font-mono uppercase tracking-[0.2em]">Convening Swarm Council...</p>
          </div>
        ) : rounds.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-40 grayscale space-y-4">
            <CheckCircle2 className="w-12 h-12 mx-auto" />
            <p className="text-[10px] font-bold uppercase tracking-widest">All architectural conflicts resolved</p>
          </div>
        ) : (
          rounds.map(round => (
            <div 
              key={round.id}
              className="p-4 bg-white/5 border border-white/10 rounded-xl hover:border-codex-neon/30 transition-all space-y-4"
            >
              <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-3">
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-tight">
                    Issue: {round.issueDescription}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn(
                        "text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest",
                        round.status === 'ACTIVE' ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-codex-neon/20 text-codex-neon border border-codex-neon/30"
                    )}>
                        {round.status}
                    </span>
                    <span className="text-[8px] text-white/30 font-mono">#{round.id.substring(0, 8)}</span>
                  </div>
                </div>
                <div className="text-right">
                    <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest block">Voters</span>
                    <span className="text-sm font-black text-white">{round.votes.length}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {round.competingProposals.map(proposal => {
                    const proposalVotes = round.votes.filter(v => v.proposalId === proposal.id);
                    const totalScore = proposalVotes.reduce((acc, v) => acc + v.score, 0);
                    const isWinner = round.winnerId === proposal.id;

                    return (
                        <div key={proposal.id} className={cn(
                            "p-3 rounded-lg border transition-all",
                            isWinner ? "bg-codex-neon/10 border-codex-neon/40 shadow-[0_0_15px_rgba(204,255,0,0.1)]" : "bg-black/40 border-white/5"
                        )}>
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div>
                                    <h5 className="text-[10px] font-black text-white uppercase">{proposal.title}</h5>
                                    <p className="text-[9px] text-white/60 leading-tight">{proposal.description}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-black text-codex-neon tabular-nums">+{totalScore}</div>
                                    <span className="text-[7px] font-bold text-white/20 uppercase tracking-widest">Aggregate Score</span>
                                </div>
                            </div>

                            <div className="space-y-1.5 mt-3">
                                {proposalVotes.map(vote => (
                                    <div key={vote.agentId} className="group relative flex items-start gap-2 p-1.5 bg-white/5 rounded border border-white/5 hover:border-white/20 transition-all">
                                        <div className="w-1 h-full absolute left-0 top-0 rounded-l bg-codex-neon/40" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[8px] font-black text-white/80 uppercase truncate">{vote.agentName}</span>
                                                <span className="text-[7px] font-mono text-codex-neon/60">+{vote.score}</span>
                                            </div>
                                            <p className="text-[8px] text-white/40 italic leading-snug truncate group-hover:whitespace-normal group-hover:bg-black/90 group-hover:p-2 group-hover:absolute group-hover:z-50 group-hover:border group-hover:border-codex-neon/20 group-hover:rounded-lg group-hover:w-[200px]">
                                                "{vote.rationale}"
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {round.status === 'ACTIVE' && (
                                <button
                                    onClick={() => {/* Resolve logic */}}
                                    className="w-full mt-3 py-1.5 bg-codex-neon text-black text-[9px] font-black uppercase tracking-[0.2em] rounded hover:brightness-110 transition-all shadow-[0_0_10px_rgba(204,255,0,0.2)]"
                                >
                                    Settle Conflict
                                </button>
                            )}
                        </div>
                    );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 p-3 bg-codex-neon/5 border border-codex-neon/10 rounded-xl flex items-start gap-3 shrink-0">
        <AlertCircle className="w-4 h-4 text-codex-neon shrink-0 mt-0.5" />
        <p className="text-[9px] text-codex-neon/60 leading-relaxed font-bold uppercase tracking-tight">
          Consensus rounds are triggered automatically for high-risk operations. The user acts as the final tie-breaker and adjudicator for architectural divergence.
        </p>
      </div>
    </div>
  );
};
