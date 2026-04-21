import React from 'react';
import { useHealthStatus } from '../hooks/useHealthStatus';
import { Activity, Cpu, Database, Server } from 'lucide-react';

export const HealthDashboard: React.FC = () => {
  const { status, loading } = useHealthStatus();

  if (loading || !status) {
    return <div className="p-4 text-zinc-500 animate-pulse">Initializing diagnostics...</div>;
  }

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const getStatusColor = (s: string) => {
    if (s === 'Healthy') return 'text-green-400';
    if (s === 'Warning') return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="p-4 bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-2xl flex flex-col h-full relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -mr-16 -mt-16" />
      
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Server size={16} className="text-emerald-400" />
          </div>
          <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-tight">System Health</h3>
        </div>
        <div className={`text-[9px] font-black px-2 py-0.5 rounded-md bg-zinc-900 border border-white/5 shadow-inner ${getStatusColor(status.status)}`}>
          {status.status.toUpperCase()}
        </div>
      </div>

      <div className="space-y-6 flex-1 relative z-10">
        {/* CPU */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              <Cpu size={12} />
              <span>CPU Compute</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-zinc-200 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/5">
              {status.cpu_usage.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-white/5">
            <div 
              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)] transition-all duration-1000 ease-out" 
              style={{ width: `${status.cpu_usage}%` }}
            />
          </div>
        </div>

        {/* Memory */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
              <Database size={12} />
              <span>Memory Pool</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-zinc-200 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/5">
              {formatBytes(status.memory_usage)} / {formatBytes(status.total_memory)}
            </span>
          </div>
          <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-white/5">
            <div 
              className="h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.3)] transition-all duration-1000 ease-out" 
              style={{ width: `${(status.memory_usage / status.total_memory) * 100}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mt-auto">
          <div className="p-3 rounded-xl bg-zinc-900/50 border border-white/5 shadow-inner">
            <div className="text-[9px] text-zinc-500 uppercase tracking-widest font-black mb-1">Threads</div>
            <div className="text-xs font-mono font-bold text-zinc-100">{status.threads}</div>
          </div>
          <div className="p-3 rounded-xl bg-zinc-900/50 border border-white/5 shadow-inner">
            <div className="text-[9px] text-zinc-500 uppercase tracking-widest font-black mb-1">Engine</div>
            <div className="text-xs font-mono font-bold text-emerald-400">READY</div>
          </div>
        </div>
      </div>
    </div>
  );
};
