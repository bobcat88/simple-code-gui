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
import { SavingsHud } from './SavingsHud'

interface HeaderProps {
  activeTab: OpenTab | null
  openTabs: OpenTab[]
  viewMode: 'tabs' | 'tiled'
  onToggleViewMode: () => void
  onNewSession: () => void
  onSwitchToTab: (id: string) => void
  onCloseTab: (id: string) => void
  api: any
}

export function Header({ 
  activeTab, 
  openTabs,
  viewMode, 
  onToggleViewMode, 
  onNewSession,
  onSwitchToTab,
  onCloseTab,
  api
}: HeaderProps) {
  return (
    <header className="h-14 glass-header flex items-center px-4 gap-4 sticky top-0 z-10" data-tauri-drag-region>
      <div className="flex items-center gap-2 text-muted-foreground shrink-0 border-r border-border pr-4 h-8" data-tauri-drag-region>
        <TerminalIcon size={16} data-tauri-drag-region />
        <span className="text-xs font-bold uppercase tracking-wider select-none" data-tauri-drag-region>Codex One</span>
      </div>
      
      <SessionSwitcher 
        tabs={openTabs}
        activeTabId={activeTab?.id || null}
        onSwitchToTab={onSwitchToTab}
        onCloseTab={onCloseTab}
        onNewSession={onNewSession}
      />

      <div className="flex-1 flex justify-center" data-tauri-drag-region>
        <SavingsHud api={api} className="animate-in fade-in slide-in-from-top-2 duration-700" />
      </div>

      <div className="flex items-center gap-2 shrink-0">

        <div className="relative hidden lg:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" size={13} />
          <input 
            type="text" 
            placeholder="Search commands..." 
            className="h-8 w-40 bg-white/5 border border-white/5 hover:border-white/10 focus:border-primary/40 focus:bg-white/10 rounded-md pl-8 pr-3 text-[11px] outline-none transition-all placeholder:text-white/20"
          />
        </div>

        <div className="h-6 w-[1px] bg-border mx-1" />

        <button
          className={cn(
            "p-2 rounded-md transition-all",
            "hover:bg-white/5 text-white/40 hover:text-white/80 active:scale-95"
          )}
          onClick={onToggleViewMode}
          title={viewMode === 'tabs' ? 'Switch to tiled view' : 'Switch to tabs view'}
        >
          {viewMode === 'tabs' ? <LayoutGrid size={16} /> : <TerminalIcon size={16} />}
        </button>

        <button className="p-2 rounded-md hover:bg-white/5 text-white/40 hover:text-white/80 transition-all active:scale-95">
          <MoreVertical size={16} />
        </button>
      </div>
    </header>
  )
}
