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
    <div className="p-4 bg-zinc-950/40 backdrop-blur-xl border border-white/5 rounded-2xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Server size={18} className="text-emerald-400" />
          <h3 className="text-sm font-semibold text-zinc-100">System Health</h3>
        </div>
        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/5 ${getStatusColor(status.status)}`}>
          {status.status.toUpperCase()}
        </div>
      </div>

      <div className="space-y-6 flex-1">
        {/* CPU */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Cpu size={14} />
              <span>CPU Load</span>
            </div>
            <span className="text-xs font-mono text-zinc-200">{status.cpu_usage.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all duration-500" 
              style={{ width: `${status.cpu_usage}%` }}
            />
          </div>
        </div>

        {/* Memory */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <Database size={14} />
              <span>Memory Usage</span>
            </div>
            <span className="text-xs font-mono text-zinc-200">
              {formatBytes(status.memory_usage)} / {formatBytes(status.total_memory)}
            </span>
          </div>
          <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-500" 
              style={{ width: `${(status.memory_usage / status.total_memory) * 100}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mt-auto">
          <div className="p-3 rounded-xl bg-white/5 border border-white/5">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Threads</div>
            <div className="text-sm font-bold text-zinc-200">{status.threads}</div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/5">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Uptime</div>
            <div className="text-sm font-bold text-zinc-200">Live</div>
          </div>
        </div>
      </div>
    </div>
  );
};
