import React from 'react'
import { Server, Activity, Settings2 } from 'lucide-react'
import { useExtensions, InstalledExtension } from '../hooks/useExtensions'
import { cn } from '../lib/utils'

interface McpPanelProps {
  projectPath: string | null
}

export function McpPanel({ projectPath }: McpPanelProps) {
  const { data: extensions, isLoading } = useExtensions()
  
  const mcpExtensions = extensions?.filter(ext => ext.type === 'mcp') || []
  
  if (isLoading) {
    return <div className="p-4 text-xs text-muted-foreground">Loading MCP servers...</div>
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="px-2 py-1 text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center justify-between">
          <span>MCP Servers</span>
          <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-medium">
            {mcpExtensions.length}
          </span>
        </h3>
        
        {mcpExtensions.length === 0 ? (
          <div className="px-3 py-4 text-sm text-muted-foreground italic bg-muted/30 rounded-lg border border-dashed border-border mx-2">
            No MCP servers installed
          </div>
        ) : (
          <div className="space-y-1 px-1">
            {mcpExtensions.map((mcp) => (
              <McpItem key={mcp.id} mcp={mcp} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function McpItem({ mcp }: { mcp: InstalledExtension }) {
  return (
    <div className="group relative flex flex-col p-2 rounded-md hover:bg-accent/50 transition-all border border-transparent hover:border-border">
      <div className="flex items-center gap-3">
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
        <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-all">
          <Settings2 size={12} className="text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}
