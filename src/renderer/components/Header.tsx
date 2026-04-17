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
import { cn } from '../lib/utils'

import { SessionSwitcher } from './SessionSwitcher'

interface HeaderProps {
  activeTab: OpenTab | null
  openTabs: OpenTab[]
  viewMode: 'tabs' | 'tiled'
  onToggleViewMode: () => void
  onNewSession: () => void
  onSwitchToTab: (id: string) => void
  onCloseTab: (id: string) => void
}

export function Header({ 
  activeTab, 
  openTabs,
  viewMode, 
  onToggleViewMode, 
  onNewSession,
  onSwitchToTab,
  onCloseTab
}: HeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-background/60 backdrop-blur-md flex items-center px-4 gap-4 sticky top-0 z-10">
      <div className="flex items-center gap-2 text-muted-foreground shrink-0 border-r border-border pr-4 h-8">
        <TerminalIcon size={16} />
        <span className="text-xs font-bold uppercase tracking-wider select-none">Codex One</span>
      </div>
      
      <SessionSwitcher 
        tabs={openTabs}
        activeTabId={activeTab?.id || null}
        onSwitchToTab={onSwitchToTab}
        onCloseTab={onCloseTab}
        onNewSession={onNewSession}
      />

      <div className="flex items-center gap-2 shrink-0">
        <div className="relative hidden lg:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={13} />
          <input 
            type="text" 
            placeholder="Search commands..." 
            className="h-8 w-40 bg-muted/30 border border-transparent hover:border-border focus:border-primary/50 focus:bg-background/50 rounded-md pl-8 pr-3 text-[11px] outline-none transition-all placeholder:text-muted-foreground/40"
          />
        </div>

        <div className="h-6 w-[1px] bg-border mx-1" />

        <button
          className={cn(
            "p-2 rounded-md transition-all",
            "hover:bg-muted text-muted-foreground hover:text-foreground active:scale-95"
          )}
          onClick={onToggleViewMode}
          title={viewMode === 'tabs' ? 'Switch to tiled view' : 'Switch to tabs view'}
        >
          {viewMode === 'tabs' ? <LayoutGrid size={18} /> : <TerminalIcon size={18} />}
        </button>

        <button className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-all active:scale-95">
          <MoreVertical size={18} />
        </button>
      </div>
    </header>
  )
}
