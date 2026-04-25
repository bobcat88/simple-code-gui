import React, { useEffect, useState } from 'react'
import { Coins, Zap, BarChart3 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useSessionId } from '../../hooks/useSessionId'

interface CostStats {
  sessionCost: number
  totalCost: number
  sessionTokens: number
  totalTokens: number
}

interface CostHUDProps {
  api: any
  className?: string
}

export function CostHUD({ api, className }: CostHUDProps) {
  const sessionId = useSessionId()
  const [stats, setStats] = useState<CostStats>({
    sessionCost: 0,
    totalCost: 0,
    sessionTokens: 0,
    totalTokens: 0
  })

  useEffect(() => {
    if (!sessionId || !api.getTokenHistory) return

    const fetchStats = async () => {
      try {
        // Fetch session totals
        const sessionHistory = await api.getTokenHistory({ nexus_session_id: sessionId })
        // Fetch lifetime totals
        const totalHistory = await api.getTokenHistory({})

        setStats({
          sessionCost: sessionHistory.totals.costEstimate,
          totalCost: totalHistory.totals.costEstimate,
          sessionTokens: sessionHistory.totals.inputTokens + sessionHistory.totals.outputTokens,
          totalTokens: totalHistory.totals.inputTokens + totalHistory.totals.outputTokens
        })
      } catch (err) {
        console.error('Failed to fetch cost stats:', err)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 5000) // Update every 5s
    return () => clearInterval(interval)
  }, [api, sessionId])

  return (
    <div className={cn("flex items-center gap-4 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-medium backdrop-blur-md shadow-lg", className)}>
      <div className="flex items-center gap-1.5 text-amber-400/90" title="Current Session Cost">
        <Zap size={12} className="text-amber-400" />
        <span className="opacity-60 uppercase tracking-widest text-[9px]">Session:</span>
        <span className="font-mono">${stats.sessionCost.toFixed(3)}</span>
      </div>
      
      <div className="w-[1px] h-3 bg-white/10" />
      
      <div className="flex items-center gap-1.5 text-indigo-400/90" title="Lifetime Project Cost">
        <Coins size={12} className="text-indigo-400" />
        <span className="opacity-60 uppercase tracking-widest text-[9px]">Total:</span>
        <span className="font-mono">${stats.totalCost.toFixed(3)}</span>
      </div>

      <div className="w-[1px] h-3 bg-white/10" />

      <div className="flex items-center gap-1.5 text-blue-400/90" title="Total Tokens in Session">
        <BarChart3 size={12} className="text-blue-400" />
        <span className="font-mono">{(stats.sessionTokens / 1000).toFixed(1)}k tokens</span>
      </div>
    </div>
  )
}
