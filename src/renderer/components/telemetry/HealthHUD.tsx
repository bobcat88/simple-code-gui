import React from 'react';
import { Cpu, Database, HeartPulse } from 'lucide-react';
import { useHealthStatus } from '../../hooks/useHealthStatus';
import { cn } from '../../lib/utils';

interface HealthHUDProps {
  className?: string;
}

export function HealthHUD({ className }: HealthHUDProps) {
  const { status, loading } = useHealthStatus();

  if (loading || !status) return null;

  const cpuColor = status.cpu_usage > 80 ? 'text-rose-400' : status.cpu_usage > 50 ? 'text-amber-400' : 'text-indigo-400';
  const memColor = (status.memory_usage / status.total_memory) > 0.8 ? 'text-rose-400' : (status.memory_usage / status.total_memory) > 0.5 ? 'text-amber-400' : 'text-indigo-400';

  return (
    <div 
      className={cn(
        "flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-medium transition-all duration-300",
        className
      )}
    >
      <div className="flex items-center gap-1.5" title="System Health Status">
        <HeartPulse size={12} className="text-emerald-400" />
        <span className="text-white/60">Healthy</span>
      </div>

      <div className="w-[1px] h-3 bg-white/10" />

      <div className="flex items-center gap-1.5" title="CPU Usage">
        <Cpu size={12} className={cpuColor} />
        <span className="text-white/80">{status.cpu_usage.toFixed(0)}%</span>
      </div>

      <div className="w-[1px] h-3 bg-white/10" />

      <div className="flex items-center gap-1.5" title="Memory Usage">
        <Database size={12} className={memColor} />
        <span className="text-white/80">{(status.memory_usage / 1024 / 1024 / 1024).toFixed(1)}GB</span>
      </div>
    </div>
  );
}
