import { useState, useEffect, useCallback } from 'react'
import type { ProjectIntelligence, ExtendedApi } from '../api/types'

export function useProjectIntelligence(api: ExtendedApi, projectPath: string | null) {
  const [intelligence, setIntelligence] = useState<ProjectIntelligence | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchIntelligence = useCallback(async () => {
    if (!projectPath) {
      setIntelligence(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const result = await api.scanProjectIntelligence(projectPath)
      setIntelligence(result)
    } catch (err) {
      console.error('Failed to fetch project intelligence:', err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [api, projectPath])

  useEffect(() => {
    fetchIntelligence()
    
    // Poll every 30 seconds if active
    const interval = setInterval(fetchIntelligence, 30000)
    return () => clearInterval(interval)
  }, [fetchIntelligence])

  return { intelligence, loading, error, refresh: fetchIntelligence }
}
