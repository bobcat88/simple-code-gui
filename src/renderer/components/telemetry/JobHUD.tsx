import React from 'react'
import { Activity, Clock, Server, Play, Square, Loader2 } from 'lucide-react'
import { useJobStore } from '../../stores/jobs'
import { cn } from '../../lib/utils'

interface JobHUDProps {
  className?: string
  api: any
}

export function JobHUD({ className, api }: JobHUDProps) {
  const { status, lastUpdate } = useJobStore()

  if (!status) return null

  const isRunning = status.running
  const activeCount = status.activeInvocations || 0
  const queuedCount = status.queuedInvocations || 0

  return (
    <div 
      className={cn(
        "flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-medium transition-all duration-300",
        isRunning ? "border-indigo-500/30 bg-indigo-500/5" : "opacity-60",
        className
      )}
    >
      <div className="flex items-center gap-1.5" title={isRunning ? "Dispatch Engine Active" : "Dispatch Engine Stopped"}>
        {isRunning ? (
          <Activity size={12} className="text-indigo-400 animate-pulse" />
        ) : (
          <Square size={10} className="text-white/20" />
        )}
        <span className={cn(isRunning ? "text-indigo-300" : "text-white/40")}>
          {isRunning ? "Engine Active" : "Engine IDLE"}
        </span>
      </div>

      <div className="w-[1px] h-3 bg-white/10" />

      <div className="flex items-center gap-1.5 text-emerald-400/90" title="Active background jobs">
        {activeCount > 0 ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Server size={12} />
        )}
        <span>{activeCount} Active</span>
      </div>

      {queuedCount > 0 && (
        <>
          <div className="w-[1px] h-3 bg-white/10" />
          <div className="flex items-center gap-1.5 text-amber-400/90" title="Queued background jobs">
            <Clock size={12} />
            <span>{queuedCount} Queued</span>
          </div>
        </>
      )}
      
      {isRunning && activeCount === 0 && (
        <div className="flex items-center gap-1 ml-1">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/40" />
        </div>
      )}
    </div>
  )
}
