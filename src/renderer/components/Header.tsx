import React from 'react'
import { 
  ChevronRight, 
  Terminal as TerminalIcon, 
  MoreVertical, 
  LayoutGrid,
  Search,
  Plus
} from 'lucide-react'
import { OpenTab } from '../stores/workspace'
import { cn } from '../utils/cn'

interface HeaderProps {
  activeTab: OpenTab | null
  viewMode: 'tabs' | 'tiled'
  onToggleViewMode: () => void
  onNewSession: () => void
}

export function Header({ activeTab, viewMode, onToggleViewMode, onNewSession }: HeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-background/60 backdrop-blur-md flex items-center px-4 justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="flex items-center gap-2 text-muted-foreground shrink-0">
          <TerminalIcon size={18} />
          <span className="text-sm font-medium">Sessions</span>
          <ChevronRight size={14} />
        </div>
        
        {activeTab ? (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold truncate text-foreground">
              {activeTab.title || 'New Session'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-mono border border-primary/20 shrink-0">
              {activeTab.id.slice(0, 8)}
            </span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground italic">No active session</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="relative mr-2 hidden md:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <input 
            type="text" 
            placeholder="Search commands..." 
            className="h-8 w-48 bg-muted/50 border border-transparent hover:border-border focus:border-primary focus:bg-background rounded-md pl-9 pr-3 text-xs outline-none transition-all"
          />
        </div>

        <button 
          onClick={onNewSession}
          className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          title="New Session"
        >
          <Plus size={18} />
        </button>

        <div className="h-6 w-[1px] bg-border mx-1" />

        <button
          className={cn(
            "p-1.5 rounded-md transition-colors",
            "hover:bg-muted text-muted-foreground hover:text-foreground"
          )}
          onClick={onToggleViewMode}
          title={viewMode === 'tabs' ? 'Switch to tiled view' : 'Switch to tabs view'}
        >
          {viewMode === 'tabs' ? <LayoutGrid size={18} /> : <TerminalIcon size={18} />}
        </button>

        <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
          <MoreVertical size={18} />
        </button>
      </div>
    </header>
  )
}
