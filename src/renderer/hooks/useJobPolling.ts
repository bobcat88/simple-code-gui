import { useEffect, useCallback } from 'react'
import { useJobStore } from '../stores/jobs'
import { useWorkspaceStore } from '../stores/workspace'
import { tauriIpc } from '../lib/tauri-ipc'

export function useJobPolling(api: any) {
  const { setStatus, setJobs, setPolling, updateJob } = useJobStore()
  const { projects } = useWorkspaceStore()
  
  const fetchStatus = useCallback(async () => {
    const { projects, openTabs, activeTabId } = useWorkspaceStore.getState()
    
    // Determine the active project path from the active tab
    const activeTab = openTabs.find(t => t.id === activeTabId)
    const activeProjectPath = activeTab?.projectPath || projects[0]?.path
    
    try {
      // 1. Poll Kspec dispatch status if available
      if (activeProjectPath && api.kspecDispatchStatus) {
        const status = await api.kspecDispatchStatus(activeProjectPath)
        setStatus(status)
      }

      // 2. Poll generic background jobs
      if (api.jobsList) {
        const jobs = await api.jobsList()
        setJobs(jobs)
      }
    } catch (err) {
      console.error('Failed to poll job status:', err)
    }
  }, [api, setStatus, setJobs])

  useEffect(() => {
    setPolling(true)
    fetchStatus()
    const interval = setInterval(fetchStatus, 3000) // Poll every 3 seconds
    
    return () => {
      clearInterval(interval)
      setPolling(false)
    }
  }, [fetchStatus, setPolling])

  // Real-time event listeners
  useEffect(() => {
    const p1 = tauriIpc.onJobProgress((data: any) => {
      updateJob(data.id, { progress: data.progress });
    });
    
    const p2 = tauriIpc.onJobStatusChanged((_id: string) => {
      // Re-fetch all to get the new status and potentially results/errors
      fetchStatus();
    });

    return () => {
      p1.then(unsub => unsub());
      p2.then(unsub => unsub());
    };
  }, [updateJob, fetchStatus]);
}
