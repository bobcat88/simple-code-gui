import React, { useState, useEffect } from 'react';
import { Brain, Zap, Shield, Search, CheckCircle2, XCircle, ChevronRight, Activity } from 'lucide-react';
import type { ThoughtChain, ThoughtStep } from '../../api/intelligence-types';
import { useApi } from '../../contexts/ApiContext';
import { cn } from '../../lib/utils';

interface ThoughtChainVisualizerProps {
  taskId: string;
  agentId?: string;
  onClose?: () => void;
}

export const ThoughtChainVisualizer: React.FC<ThoughtChainVisualizerProps> = ({ taskId, agentId, onClose }) => {
  const api = useApi();
  const [chain, setChain] = useState<ThoughtChain | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchChain = async () => {
    if (!api.gsdGetThoughtChain) return;
    try {
      const result = await api.gsdGetThoughtChain(taskId);
      if (result) setChain(result);
    } catch (error) {
      console.error('Failed to fetch thought chain:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChain();
    const interval = setInterval(fetchChain, 5000);
    return () => clearInterval(interval);
  }, [taskId]);

  if (loading && !chain) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4 text-neon-green/40">
        <Activity className="w-8 h-8 animate-pulse" />
        <p className="text-[10px] font-black uppercase tracking-widest">Tracing Synaptic Paths...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-obsidian-dark/95 backdrop-blur-xl border border-neon-green/20 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
      <div className="p-4 bg-black/40 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-neon-green/10 border border-neon-green/20">
            <Brain className="w-4 h-4 text-neon-green" />
          </div>
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-tighter leading-none">Quantum Reasoning Trace</h3>
            <span className="text-[8px] font-mono text-neon-green/60 uppercase mt-1 block">Task: {taskId.substring(0, 12)}...</span>
          </div>
        </div>
        {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg text-white/40 hover:text-white transition-colors">
                <XCircle className="w-4 h-4" />
            </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
        {chain?.steps.length === 0 ? (
            <div className="text-center py-20 opacity-30 grayscale space-y-4">
                <Search className="w-12 h-12 mx-auto" />
                <p className="text-[10px] font-bold uppercase tracking-widest">No reasoning steps recorded yet</p>
            </div>
        ) : (
            <div className="relative border-l border-white/10 ml-3 pl-8 space-y-8">
                {chain?.steps.map((step, idx) => {
                    const isLast = idx === chain.steps.length - 1;
                    const getRoleIcon = (role: string) => {
                        switch(role) {
                            case 'hypothesis': return <Search className="w-3 h-3" />;
                            case 'evidence': return <Zap className="w-3 h-3" />;
                            case 'evaluation': return <Shield className="w-3 h-3" />;
                            case 'decision': return <CheckCircle2 className="w-3 h-3" />;
                            default: return <Activity className="w-3 h-3" />;
                        }
                    };

                    const getStatusColor = (status: string) => {
                        switch(status) {
                            case 'completed': return 'text-neon-green';
                            case 'discarded': return 'text-red-400 opacity-50';
                            default: return 'text-amber-400';
                        }
                    };

                    return (
                        <div key={step.id} className={cn(
                            "relative animate-in slide-in-from-left-4 duration-500",
                            step.status === 'discarded' && "grayscale-[0.8]"
                        )}>
                            {/* Dot on timeline */}
                            <div className={cn(
                                "absolute -left-[41px] top-0 w-6 h-6 rounded-full border border-white/10 flex items-center justify-center z-10",
                                step.status === 'completed' ? "bg-neon-green text-black" : 
                                step.status === 'discarded' ? "bg-black text-red-400" : "bg-black text-amber-400"
                            )}>
                                {getRoleIcon(step.role)}
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all group relative">
                                <div className="flex items-center justify-between mb-2">
                                    <span className={cn("text-[8px] font-black uppercase tracking-widest", getStatusColor(step.status))}>
                                        {step.role} • {step.status}
                                    </span>
                                    {step.evaluationScore !== undefined && (
                                        <div className="flex items-center gap-1">
                                            <span className="text-[8px] font-bold text-white/20 uppercase">Score</span>
                                            <span className="text-xs font-black text-neon-green">{Math.round(step.evaluationScore * 100)}</span>
                                        </div>
                                    )}
                                </div>

                                <p className="text-[10px] text-white/80 leading-relaxed font-medium">
                                    {step.content}
                                </p>

                                {step.status === 'discarded' && (
                                    <div className="mt-3 pt-3 border-t border-white/5">
                                        <p className="text-[8px] text-red-400/60 uppercase font-black tracking-widest italic">
                                            Path Pruned: Found suboptimal during evaluation.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>

      <div className="p-4 bg-neon-green/5 border-t border-neon-green/10 shrink-0">
          <div className="flex items-start gap-3">
              <Activity className="w-4 h-4 text-neon-green shrink-0 mt-0.5" />
              <p className="text-[9px] text-neon-green/60 leading-relaxed font-bold uppercase tracking-tight">
                  Thought chains represent speculative reasoning paths. Discarded steps indicate branches the agent explored but rejected in favor of more optimal solutions.
              </p>
          </div>
      </div>
    </div>
  );
};
