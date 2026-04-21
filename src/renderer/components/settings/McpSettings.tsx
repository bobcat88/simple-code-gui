import React from 'react'
import { McpPanel } from '../McpPanel'
import { BeadsPanel } from '../BeadsPanel'
import { GSDStatus } from '../GSDStatus'
import { Api } from '../../api/types.js'

interface McpSettingsProps {
  projectPath: string | null
  focusedTabPtyId: string | null
  onOpenSession: (path: string, sessionId?: string, ptyId?: string, prompt?: string, forceNew?: boolean) => void
  api: Api
}

export function McpSettings({ projectPath, focusedTabPtyId, onOpenSession, api }: McpSettingsProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          Agents & Tracking
        </h3>
        <div className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-4">
          <BeadsPanel
            projectPath={projectPath}
            isExpanded={true}
            onToggle={() => {}}
            onStartTaskInNewTab={(prompt) => {
              if (projectPath) onOpenSession(projectPath, undefined, undefined, prompt, true)
            }}
            onSendToCurrentTab={(prompt) => {
              if (focusedTabPtyId) {
                api.writePty?.(focusedTabPtyId, prompt)
                setTimeout(() => api.writePty?.(focusedTabPtyId, '\r'), 100)
              }
            }}
            currentTabPtyId={focusedTabPtyId}
          />
          <div className="pt-4 border-t border-border/50">
            <GSDStatus
              projectPath={projectPath}
              onCommand={(cmd) => {
                if (focusedTabPtyId) {
                  window.electronAPI?.writePty(focusedTabPtyId, cmd)
                  setTimeout(() => window.electronAPI?.writePty(focusedTabPtyId, '\r'), 100)
                }
              }}
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          MCP Servers
        </h3>
        <div className="bg-muted/30 rounded-xl border border-border/50">
          <McpPanel projectPath={projectPath} api={api} />
        </div>
      </section>
    </div>
  )
}
