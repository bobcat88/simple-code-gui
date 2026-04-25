import { useEffect } from 'react'
import type { Api } from '../api'
import type { BackendId } from '../api/types'
import type { AppSettings } from './useSettings'
import { useWorkspaceStore, OpenTab, Project } from '../stores/workspace'
import { calculatePtyDimensions } from '../components/terminal/utils.js'

interface UseApiListenersOptions {
  api: Api
  projects: Project[]
  settings: AppSettings | null
  addTab: (tab: OpenTab) => void
  updateTab: (id: string, updates: Partial<OpenTab>) => void
  setActiveTab: (id: string) => void
}

export function useApiListeners({
  api,
  projects,
  settings,
  addTab,
  updateTab,
  setActiveTab
}: UseApiListenersOptions): void {
  // Listen for API requests to open new sessions
  useEffect(() => {
    const unsubscribe = api.onApiOpenSession(async ({ projectPath, autoClose, model }: { projectPath: string; autoClose?: boolean; model?: string }) => {
      // Open a new session for this project (API-triggered)
      const modelLabel = model && model !== 'default' ? ` [${model}]` : ''
      const title = `${projectPath.split(/[/\\]/).pop() || projectPath} - API${modelLabel}${autoClose ? ' (auto-close)' : ''}`

      // Get project and determine effective backend
      const project = projects.find((p) => p.path === projectPath)

      const effectiveBackend = (project?.backend && project.backend !== 'default'
        ? project.backend
        : (settings?.backend && settings.backend !== 'default'
          ? settings.backend
          : 'claude')) as BackendId

      try {
        // Always install TTS instructions so Claude uses <tts> tags
        await api.ttsInstallInstructions?.(projectPath)

        // Use window size as a fallback estimate
        const { cols, rows } = calculatePtyDimensions(window.innerWidth, window.innerHeight)

        const ptyId = await api.spawnPty(projectPath, undefined, model, effectiveBackend, rows, cols)
        addTab({
          id: ptyId,
          projectPath,
          title,
          ptyId,
          backend: effectiveBackend
        })
      } catch (e: any) {
        console.error('Failed to spawn PTY for API request:', e)
      }
    })

    return unsubscribe
  }, [api, addTab, projects, settings?.backend])

  // Listen for PTY recreation events
  useEffect(() => {
    const unsubscribe = api.onPtyRecreated(({ oldId, newId, backend }) => {
      console.log(`PTY recreated: ${oldId} -> ${newId} with backend ${backend}`)
      // Find the tab with the old ID
      const tab = useWorkspaceStore.getState().openTabs.find((t) => t.id === oldId)
      if (tab) {
        // Update the tab with the new ID and backend
        updateTab(oldId, { id: newId, ptyId: newId, backend })
        // If it was the active tab, update the active tab ID
        if (useWorkspaceStore.getState().activeTabId === oldId) {
          setActiveTab(newId)
        }
      }
    })
    return unsubscribe
  }, [api, updateTab, setActiveTab])

  // Listen for model plan switches (Dynamic Plan Switching)
  useEffect(() => {
    if (!api.onModelPlanSwitched) return

    const unsubscribe = api.onModelPlanSwitched(({ old_plan, new_plan, health_score }) => {
      console.log(`[DynamicPlanSwitching] Plan switched from ${old_plan} to ${new_plan} (Health: ${health_score.toFixed(2)})`)
      // You could trigger a toast here if a notification system was available
      // For now, logging to activity feed via API if supported, or just console
      if (api.activityLogInfo) {
        api.activityLogInfo(
          'System', 
          `Dynamic Plan Switching: Switched to ${new_plan} plan (Health Score: ${health_score.toFixed(2)})`,
          JSON.stringify({ old_plan, new_plan, health_score })
        )
      }
    })
    return unsubscribe
  }, [api])
}
