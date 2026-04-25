import React from 'react'
import { 
  ChevronRight, 
  Terminal as TerminalIcon, 
  MoreVertical, 
  LayoutGrid,
  Search,
  Plus,
  Activity,
  MessageSquare
} from 'lucide-react'
import { OpenTab } from '../stores/workspace'
import { cn } from '../lib/utils'

import { SessionSwitcher } from './SessionSwitcher'
import { SavingsHud } from './SavingsHud'
import { JobHUD } from './telemetry/JobHUD'
import { HealthHUD } from './telemetry/HealthHUD'
import { CostHUD } from './telemetry/CostHUD'

interface HeaderProps {
  activeTab: OpenTab | null
  openTabs: OpenTab[]
  viewMode: 'tabs' | 'tiled'
  onToggleViewMode: () => void
  onNewSession: () => void
  onSwitchToTab: (id: string) => void
  onCloseTab: (id: string) => void
  onToggleIntelligence: () => void
  intelligenceCollapsed: boolean
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
  onToggleIntelligence,
  intelligenceCollapsed,
  api
}: HeaderProps) {
  return (
    <header className="h-14 glass-header flex items-center px-4 gap-4 sticky top-0 z-10" data-tauri-drag-region>
      <div className="flex items-center gap-2 text-muted-foreground shrink-0 border-r border-border pr-4 h-8" data-tauri-drag-region>
        <MessageSquare size={16} strokeWidth={2.5} className="text-primary" data-tauri-drag-region />
        <span className="text-[13px] font-bold tracking-tight text-white/90 select-none" data-tauri-drag-region>Codex</span>
      </div>
      
      <SessionSwitcher 
        tabs={openTabs}
        activeTabId={activeTab?.id || null}
        onSwitchToTab={onSwitchToTab}
        onCloseTab={onCloseTab}
        onNewSession={onNewSession}
      />

      <div className="flex-1 flex justify-center gap-4" data-tauri-drag-region>
        <SavingsHud api={api} className="animate-in fade-in slide-in-from-top-2 duration-700" />
        <CostHUD api={api} className="animate-in fade-in slide-in-from-top-2 duration-850" />
        <JobHUD api={api} className="animate-in fade-in slide-in-from-top-2 duration-1000" />
        <HealthHUD className="animate-in fade-in slide-in-from-top-2 duration-1200" />
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

        <button
          className={cn(
            "p-2 rounded-md transition-all",
            "hover:bg-white/5 text-white/40 hover:text-white/80 active:scale-95",
            !intelligenceCollapsed && "text-indigo-400 hover:text-indigo-300 bg-white/5"
          )}
          onClick={onToggleIntelligence}
          title={intelligenceCollapsed ? 'Open Intelligence Sidebar' : 'Close Intelligence Sidebar'}
        >
          <Activity size={16} />
        </button>

        <button className="p-2 rounded-md hover:bg-white/5 text-white/40 hover:text-white/80 transition-all active:scale-95">
          <MoreVertical size={16} />
        </button>
      </div>
    </header>
  )
}
