import { useEffect, useCallback } from 'react'
import { useJobStore } from '../stores/jobs'
import { useWorkspaceStore } from '../stores/workspace'

export function useJobPolling(api: any) {
  const { setStatus, setPolling } = useJobStore()
  const { projects } = useWorkspaceStore()
  
  const poll = useCallback(async () => {
    const { projects, openTabs, activeTabId } = useWorkspaceStore.getState()
    
    // Determine the active project path from the active tab
    const activeTab = openTabs.find(t => t.id === activeTabId)
    const activeProjectPath = activeTab?.projectPath || projects[0]?.path
    
    if (!activeProjectPath || !api.kspec_dispatch_status) return

    try {
      const status = await api.kspec_dispatch_status(activeProjectPath)
      setStatus(status)
    } catch (err) {
      console.error('Failed to poll job status:', err)
    }
  }, [api, projects, setStatus])

  useEffect(() => {
    setPolling(true)
    poll()
    const interval = setInterval(poll, 3000) // Poll every 3 seconds
    
    return () => {
      clearInterval(interval)
      setPolling(false)
    }
  }, [poll, setPolling])
}
