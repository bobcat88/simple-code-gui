import React from 'react';
import { useAgentBoard } from '../hooks/useAgentBoard';
import { User, Shield, PenTool, Search, GitBranch, Cpu, Activity, XCircle } from 'lucide-react';

export const AgentBoard: React.FC = () => {
  const { agents, providerHealth, loading, cancelTask, refresh } = useAgentBoard();
  const [evolving, setEvolving] = React.useState(false);

  const triggerEvolution = async () => {
    setEvolving(true);
    try {
      await tauriIpc.ai_trigger_evolution();
      await refresh();
    } finally {
      setEvolving(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-zinc-500 animate-pulse">Loading agents...</div>;
  }

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'planner': return <Shield size={16} />;
      case 'builder': return <PenTool size={16} />;
      case 'reviewer': return <Search size={16} />;
      case 'git': return <GitBranch size={16} />;
      case 'researcher': return <Search size={16} />;
      default: return <User size={16} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'idle': return 'bg-zinc-500';
      case 'working': return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]';
      case 'waiting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-zinc-500';
    }
  };

  const getEvolutionStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'stable': return 'text-zinc-400 border-zinc-800';
      case 'learning': return 'text-blue-400 border-blue-500/20 bg-blue-500/5';
      case 'optimized': return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
      default: return 'text-zinc-500 border-zinc-800';
    }
  };

  const getProviderHealthColor = (provider?: string) => {
    if (!provider) return 'bg-zinc-500';
    const isHealthy = providerHealth[provider.toLowerCase()];
    if (isHealthy === undefined) return 'bg-zinc-500';
    return isHealthy ? 'bg-emerald-500' : 'bg-amber-500';
  };

  return (
    <div className="p-4 bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-blue-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Agent Coordination</h3>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={triggerEvolution}
            disabled={evolving}
            className={`text-[10px] font-bold px-2 py-1 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-all ${evolving ? 'opacity-50 cursor-wait' : ''}`}
          >
            {evolving ? 'Evolving...' : 'Trigger Evolution'}
          </button>
          <span className="text-[10px] text-zinc-500 font-mono">{agents.length} Active</span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {agents.map((agent) => (
          <div 
            key={agent.id}
            className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-default flex flex-col"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-zinc-800 text-zinc-400">
                  {getRoleIcon(agent.role)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-zinc-200 truncate">{agent.name}</div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{agent.role}</div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 border border-white/5 ${
                  (agent.quality_score || 0) >= 0.8 ? 'text-emerald-400' : 
                  (agent.quality_score || 0) >= 0.5 ? 'text-blue-400' : 'text-zinc-500'
                }`}>
                  Q:{((agent.quality_score || 0) * 100).toFixed(0)}
                </span>
                <span className="text-[9px] font-mono text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                  ${(agent.burn_rate || 0).toFixed(4)}/h
                </span>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-zinc-500">Provider</span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${getProviderHealthColor(agent.provider)}`} />
                  <span className="text-zinc-300 font-medium capitalize">{agent.provider}</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-zinc-500">Model</span>
                <span className="text-zinc-300 font-mono truncate ml-2 max-w-[80px]" title={agent.model}>
                  {agent.model}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-zinc-500">Evolution</span>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-widest ${getEvolutionStatusColor(agent.evolution_status || 'stable')}`}>
                    {agent.evolution_status || 'stable'}
                  </span>
                  <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all" 
                      style={{ width: `${(agent.evolution_confidence || 0) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              {agent.active_task && (
                <div className="pt-2 mt-1 border-t border-white/5 group/task relative">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="text-[9px] text-zinc-500 uppercase tracking-tighter">Current Task</div>
                    <button 
                      onClick={() => cancelTask(agent.id)}
                      className="opacity-0 group-hover/task:opacity-100 text-red-400/60 hover:text-red-400 transition-all p-0.5 hover:bg-red-400/10 rounded"
                      title="Cancel Task"
                    >
                      <XCircle size={10} />
                    </button>
                  </div>
                  <div className="text-[10px] text-blue-300/80 font-medium truncate italic pr-4" title={agent.active_task}>
                    {agent.active_task}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/5">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`} />
                <span className="text-[10px] text-zinc-400 capitalize">{agent.status}</span>
                {(agent.queue_size || 0) > 0 && (
                  <span className="ml-1 text-[8px] bg-zinc-800 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-500/20 font-bold">
                    {agent.queue_size}
                  </span>
                )}
              </div>
              <div className="text-[9px] text-zinc-600">
                {agent.last_active ? 'Online' : 'Offline'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
