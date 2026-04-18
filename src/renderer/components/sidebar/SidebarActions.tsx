import React from 'react'
import { Project } from '../../stores/workspace.js'
import { ExtendedApi } from '../../api/types.js'

interface SidebarActionsProps {
  focusedProject: Project | undefined
  apiStatus: { running: boolean; port?: number } | undefined
  isDebugMode: boolean
  onOpenProjectSettings: (project: Project) => void
  onToggleApi: (project: Project) => void
  api: ExtendedApi
}

export const SidebarActions = React.memo(function SidebarActions({
  focusedProject,
  apiStatus,
  isDebugMode,
  onOpenProjectSettings,
  onToggleApi,
  api,
}: SidebarActionsProps) {
  return (
    <div className="sidebar-actions flex items-center justify-end gap-2 p-3 border-t border-border/50">
      {focusedProject && (
        <button
          className={`p-2 rounded-xl transition-all duration-300 ${apiStatus?.running ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-transparent'}`}
          onClick={() => {
            if (!focusedProject.apiPort) {
              onOpenProjectSettings(focusedProject)
            } else {
              onToggleApi(focusedProject)
            }
          }}
          tabIndex={0}
          title={
            apiStatus?.running
              ? `Stop API (port ${focusedProject.apiPort})`
              : focusedProject.apiPort
                ? `Start API (port ${focusedProject.apiPort})`
                : 'Configure API'
          }
        >
          {apiStatus?.running ? '🟢' : '🔌'}
        </button>
      )}
      {isDebugMode && (
        <button
          className="p-2 rounded-xl bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-transparent transition-all"
          onClick={() => api?.refresh?.() || window.electronAPI?.refresh?.()}
          tabIndex={0}
          title="Refresh (Debug Mode)"
        >
          🔄
        </button>
      )}
    </div>
  )
})
