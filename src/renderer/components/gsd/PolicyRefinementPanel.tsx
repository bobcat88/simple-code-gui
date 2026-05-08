import React, { useState } from 'react';
import { Shield, Zap, AlertTriangle, Check, RefreshCw } from 'lucide-react';
import type { ArchitectAuditReport, PolicyProposal } from '../../api/intelligence-types';
import { useApi } from '../../contexts/ApiContext';

interface PolicyRefinementPanelProps {
  report: ArchitectAuditReport;
  onApplied?: () => void;
}

export const PolicyRefinementPanel: React.FC<PolicyRefinementPanelProps> = ({ report, onApplied }) => {
  const { api } = useApi();
  const [proposals, setProposals] = useState<PolicyProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);

  const fetchProposals = async () => {
    if (!api.gsdProposePolicyRefinement) return;
    setLoading(true);
    try {
      const result = await api.gsdProposePolicyRefinement(report);
      setProposals(result);
    } catch (error) {
      console.error('Failed to fetch policy proposals:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyProposal = async (proposalId: string) => {
    if (!api.gsdApplyPolicyProposal) return;
    setApplying(proposalId);
    try {
      await api.gsdApplyPolicyProposal(proposalId);
      setProposals(prev => prev.filter(p => p.id !== proposalId));
      onApplied?.();
    } catch (error) {
      console.error('Failed to apply policy proposal:', error);
    } finally {
      setApplying(null);
    }
  };

  React.useEffect(() => {
    fetchProposals();
  }, [report]);

  return (
    <div className="space-y-4 p-4 bg-obsidian-dark/50 border border-neon-green/20 rounded-xl borg-glass">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-neon-green flex items-center gap-2 uppercase tracking-widest">
          <Shield className="w-4 h-4" />
          AI Policy Refinement Loop
        </h3>
        <button 
          onClick={fetchProposals}
          disabled={loading}
          className="p-1 hover:bg-neon-green/10 rounded transition-colors disabled:opacity-50"
          title="Refresh Proposals"
        >
          <RefreshCw className={`w-3 h-3 text-neon-green/60 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && proposals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Zap className="w-8 h-8 text-neon-green animate-pulse" />
          <p className="text-xs text-neon-green/40 font-mono uppercase">Analyzing governance drift...</p>
        </div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-white/5 rounded-lg">
          <Check className="w-6 h-6 text-neon-green/40 mx-auto mb-2" />
          <p className="text-xs text-white/40">Active policy is synchronized with architecture.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map(proposal => (
            <div 
              key={proposal.id}
              className="p-3 bg-white/5 border border-white/10 rounded-lg hover:border-neon-green/30 transition-all group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h4 className="text-sm font-medium text-white group-hover:text-neon-green transition-colors">
                    {proposal.title}
                  </h4>
                  <p className="text-xs text-white/60 leading-relaxed mt-1">
                    {proposal.description}
                  </p>
                </div>
                <div className={`
                  px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter
                  ${proposal.riskLevel === 'HIGH' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
                    proposal.riskLevel === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 
                    'bg-neon-green/20 text-neon-green border border-neon-green/30'}
                `}>
                  {proposal.riskLevel} Risk
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 my-3 p-2 bg-black/40 rounded border border-white/5">
                <div className="text-[10px]">
                  <span className="text-white/40 block uppercase tracking-tighter mb-0.5">Current</span>
                  <code className="text-red-400/80">{proposal.currentValue}</code>
                </div>
                <div className="text-[10px]">
                  <span className="text-white/40 block uppercase tracking-tighter mb-0.5">Proposed</span>
                  <code className="text-neon-green">{proposal.proposedValue}</code>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2 bg-neon-green/5 rounded border border-neon-green/10 mb-3">
                <AlertTriangle className="w-3 h-3 text-neon-green shrink-0 mt-0.5" />
                <p className="text-[10px] text-neon-green/80 italic leading-snug">
                  {proposal.rationale}
                </p>
              </div>

              <button
                onClick={() => applyProposal(proposal.id)}
                disabled={applying === proposal.id}
                className="w-full py-1.5 bg-neon-green text-obsidian-dark text-[10px] font-bold uppercase tracking-widest rounded hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {applying === proposal.id ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Check className="w-3 h-3" />
                )}
                Apply Policy Update
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
