import React, { useState } from 'react'
import { Server, Settings2 } from 'lucide-react'
import { useExtensions, InstalledExtension } from '../hooks/useExtensions'
import { McpConfigEditor } from './McpConfigEditor'
import { cn } from '../lib/utils'
import { useQueryClient } from '@tanstack/react-query'

interface McpPanelProps {
  projectPath: string | null
}

export function McpPanel({ projectPath }: McpPanelProps) {
  const { data: extensions, isLoading } = useExtensions()
  const [editingId, setEditingId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  
  const mcpExtensions = extensions?.filter(ext => ext.type === 'mcp') || []
  
  if (isLoading) {
    return <div className="p-4 text-xs text-muted-foreground">Loading MCP servers...</div>
  }

  const handleSaveConfig = async (id: string, config: any) => {
    try {
      await window.electronAPI?.extensionsSetConfig?.(id, config)
      queryClient.invalidateQueries({ queryKey: ['extensions'] })
      setEditingId(null)
    } catch (e) {
      console.error('Failed to save MCP config', e)
    }
  }

  const handleToggleProject = async (id: string, enabled: boolean) => {
    if (!projectPath) return
    try {
      if (enabled) {
        await window.electronAPI?.extensionsEnableForProject?.(id, projectPath)
      } else {
        await window.electronAPI?.extensionsDisableForProject?.(id, projectPath)
      }
      queryClient.invalidateQueries({ queryKey: ['extensions'] })
    } catch (e) {
      console.error('Failed to toggle MCP for project', e)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="px-3 py-2 text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center justify-between border-b border-border/50 mb-1">
          <span>Installed Servers</span>
          <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-medium">
            {mcpExtensions.length}
          </span>
        </h3>
        
        {mcpExtensions.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground italic bg-muted/30 rounded-lg border border-dashed border-border mx-2 mt-2">
            No MCP servers installed
          </div>
        ) : (
          <div className="space-y-1 px-1">
            {mcpExtensions.map((mcp) => {
              const isEnabled = mcp.scope === 'project' ? mcp.projectPath === projectPath : mcp.enabled
              
              return (
                <div key={mcp.id} className="space-y-2">
                  {editingId === mcp.id ? (
                    <McpConfigEditor 
                      mcp={mcp} 
                      onSave={(config) => handleSaveConfig(mcp.id, config)}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <McpItem 
                      mcp={mcp} 
                      isEnabledForProject={isEnabled}
                      onToggleProject={(enabled) => handleToggleProject(mcp.id, enabled)}
                      onEdit={() => setEditingId(mcp.id)}
                      showProjectToggle={!!projectPath}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function McpItem({ 
  mcp, 
  isEnabledForProject, 
  onToggleProject, 
  onEdit, 
  showProjectToggle 
}: { 
  mcp: InstalledExtension, 
  isEnabledForProject: boolean,
  onToggleProject: (enabled: boolean) => void,
  onEdit: () => void,
  showProjectToggle: boolean
}) {
  return (
    <div className="group relative flex flex-col p-2 rounded-md hover:bg-accent/50 transition-all border border-transparent hover:border-border/50">
      <div className="flex items-center gap-3">
        {showProjectToggle && (
          <input
            type="checkbox"
            checked={isEnabledForProject}
            onChange={(e) => onToggleProject(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-white/10 bg-white/5 text-primary focus:ring-0 focus:ring-offset-0 transition-all cursor-pointer"
            title={isEnabledForProject ? "Enabled for this project" : "Disabled for this project"}
          />
        )}
        <div className="p-1.5 rounded bg-muted text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors">
          <Server size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">{mcp.name}</span>
            <span className={cn(
              "w-2 h-2 rounded-full",
              mcp.enabled ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-muted-foreground/30"
            )} />
          </div>
          <p className="text-[11px] text-muted-foreground truncate">{mcp.description}</p>
        </div>
        <button 
          onClick={onEdit}
          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-muted rounded transition-all text-muted-foreground hover:text-foreground"
        >
          <Settings2 size={13} />
        </button>
      </div>
    </div>
  )
}
