import React, { useEffect, useState } from 'react'
import { TrendingUp, Coins, Cpu } from 'lucide-react'
import { cn } from '../lib/utils'

interface TokenStats {
  totalInput: number
  totalOutput: number
  totalSaved: number
  totalCost: number
}

interface SavingsHudProps {
  api: any
  projectId?: string
  className?: string
}

export function SavingsHud({ api, projectId, className }: SavingsHudProps) {
  const [stats, setStats] = useState<TokenStats | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        if (api.getTokenStats) {
          const result = await api.getTokenStats(projectId)
          setStats(result)
        }
      } catch (err) {
        console.error('Failed to fetch token stats:', err)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 10000) // Update every 10s
    return () => clearInterval(interval)
  }, [api, projectId])

  if (!stats) return null

  const savedPercent = stats.totalInput + stats.totalOutput > 0
    ? Math.round((stats.totalSaved / (stats.totalInput + stats.totalOutput + stats.totalSaved)) * 100)
    : 0

  return (
    <div className={cn("flex items-center gap-3 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-medium", className)}>
      <div className="flex items-center gap-1.5 text-emerald-400/90" title="Token Savings via RTK">
        <TrendingUp size={12} />
        <span>{stats.totalSaved.toLocaleString()} Saved</span>
        {savedPercent > 0 && <span className="opacity-60">({savedPercent}%)</span>}
      </div>
      
      <div className="w-[1px] h-3 bg-white/10" />
      
      <div className="flex items-center gap-1.5 text-blue-400/90" title="Total Tokens Spent">
        <Cpu size={12} />
        <span>{(stats.totalInput + stats.totalOutput).toLocaleString()} Spent</span>
      </div>

      <div className="w-[1px] h-3 bg-white/10" />

      <div className="flex items-center gap-1.5 text-amber-400/90" title="Estimated Cost">
        <Coins size={12} />
        <span>${stats.totalCost.toFixed(3)}</span>
      </div>
    </div>
  )
}
