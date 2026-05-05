import React from 'react'
import { CheckCircle2, X, FileCode, RefreshCw, Activity, Box } from 'lucide-react'
import { cn } from '../../lib/utils'

export function HealthItem({ label, active }: { label: string; active?: boolean }) {
  return (
    <div className={cn(
      "flex items-center gap-2 p-1.5 rounded-md border text-[10px] font-medium transition-colors",
      active
        ? "bg-white/5 border-white/10 text-white/70"
        : "bg-white/[0.02] border-transparent text-white/20"
    )}>
      {active ? (
        <CheckCircle2 size={10} className="text-emerald-400" />
      ) : (
        <X size={10} className="text-white/10" />
      )}
      {label}
    </div>
  )
}

export function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white/5 border border-white/5 rounded-codex p-3 flex flex-col items-center justify-center gap-1 hover:bg-white/10 hover:border-white/10 transition-all cursor-default group">
      <div className="text-sm font-bold text-white group-hover:scale-110 transition-transform tabular-nums">
        {typeof value === 'number' && value > 1000 ? `${(value / 1000).toFixed(1)}k` : value}
      </div>
      <div className="text-[9px] text-white/30 uppercase tracking-widest font-bold">{label}</div>
    </div>
  )
}

export function OperationIcon({ kind }: { kind: string }) {
  switch (kind) {
    case 'create_file': return <FileCode size={12} className="text-emerald-400 mt-0.5" />
    case 'modify_file': return <RefreshCw size={12} className="text-amber-400 mt-0.5" />
    case 'run_command': return <Activity size={12} className="text-indigo-400 mt-0.5" />
    default: return <Box size={12} className="text-white/40 mt-0.5" />
  }
}

export function RiskBadge({ risk }: { risk: string }) {
  const colors: Record<string, string> = {
    low: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    high: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  }
  return (
    <span className={cn(
      "px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase tracking-tighter",
      colors[risk?.toLowerCase()] ?? "bg-white/5 text-white/30 border-white/10"
    )}>
      {risk}
    </span>
  )
}
