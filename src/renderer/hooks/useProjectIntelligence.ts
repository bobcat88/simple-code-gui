import { useState, useEffect, useCallback } from 'react'
import type { ProjectIntelligence, ExtendedApi, ProjectCapabilityScan, VectorIndexStatus } from '../api/types'

export function useProjectIntelligence(api: ExtendedApi, projectPath: string | null) {
  const [intelligence, setIntelligence] = useState<ProjectIntelligence | null>(null)
  const [capabilityScan, setCapabilityScan] = useState<ProjectCapabilityScan | null>(null)
  const [vectorStatus, setVectorStatus] = useState<VectorIndexStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchIntelligence = useCallback(async () => {
    if (!projectPath) {
      setIntelligence(null)
      setCapabilityScan(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      // Parallel fetch for intelligence, capability scan, and vector status
      const [intelResult, scanResult, vectorResult] = await Promise.all([
        api.scanProjectIntelligence(projectPath),
        api.projectScan(projectPath, { includeCliHealth: true, includeGitHealth: true }),
        api.vectorGetStatus()
      ])
      
      setIntelligence(intelResult)
      setCapabilityScan(scanResult)
      setVectorStatus(vectorResult)
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

  const triggerDeepScan = useCallback(async () => {
    if (!projectPath) return;
    try {
      await api.projectScanAsync(projectPath);
    } catch (err) {
      console.error('Failed to trigger deep scan:', err);
    }
  }, [api, projectPath]);

  return { 
    intelligence, 
    capabilityScan, 
    vectorStatus, 
    loading, 
    error, 
    refresh: fetchIntelligence, 
    triggerDeepScan 
  }
}
