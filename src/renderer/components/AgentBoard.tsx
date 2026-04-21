import React from 'react';
import { useAgentBoard } from '../hooks/useAgentBoard';
import { User, Shield, PenTool, Search, GitBranch, Cpu, Activity } from 'lucide-react';

export const AgentBoard: React.FC = () => {
  const { agents, loading } = useAgentBoard();

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

  return (
    <div className="p-4 bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-blue-400" />
          <h3 className="text-sm font-semibold text-zinc-100">Agent Coordination</h3>
        </div>
        <span className="text-[10px] text-zinc-500 font-mono">{agents.length} Active</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {agents.map((agent) => (
          <div 
            key={agent.id}
            className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all cursor-default"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-zinc-800 text-zinc-400">
                {getRoleIcon(agent.role)}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-zinc-200 truncate">{agent.name}</div>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{agent.role}</div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-auto">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`} />
                <span className="text-[10px] text-zinc-400 capitalize">{agent.status}</span>
              </div>
              <div className="text-[9px] text-zinc-600">
                {agent.last_active ? 'Active' : 'Offline'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
