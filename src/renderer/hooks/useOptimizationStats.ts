import { useCallback, useEffect, useState } from 'react'
import type { OptimizationStatsResponse } from '../api/types'
import { tauriIpc } from '../lib/tauri-ipc'

interface UseOptimizationStatsOptions {
  sessionId?: string | null
  enabled?: boolean
  pollingInterval?: number
}

interface UseOptimizationStatsReturn {
  stats: OptimizationStatsResponse | null
}

export function useOptimizationStats({
  sessionId,
  enabled = true,
  pollingInterval = 30000,
}: UseOptimizationStatsOptions = {}): UseOptimizationStatsReturn {
  const [stats, setStats] = useState<OptimizationStatsResponse | null>(null)

  const fetchStats = useCallback(async () => {
    if (!enabled) {
      setStats(null)
      return
    }

    try {
      const nextStats = await tauriIpc.aiGetOptimizationStats(sessionId || undefined)
      setStats(nextStats)
    } catch (err) {
      console.error('Failed to fetch optimization stats:', err)
      setStats(null)
    }
  }, [enabled, sessionId])

  useEffect(() => {
    fetchStats()

    if (!enabled || pollingInterval <= 0) return
    const interval = setInterval(fetchStats, pollingInterval)
    return () => clearInterval(interval)
  }, [enabled, fetchStats, pollingInterval])

  return { stats }
}
