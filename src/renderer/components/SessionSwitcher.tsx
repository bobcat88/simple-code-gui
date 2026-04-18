import React, { useRef, useState, useEffect } from 'react'
import { X, Plus, Terminal as TerminalIcon, MoreHorizontal } from 'lucide-react'
import { OpenTab } from '../stores/workspace'
import { cn } from '../lib/utils'

interface SessionSwitcherProps {
  tabs: OpenTab[]
  activeTabId: string | null
  onSwitchToTab: (id: string) => void
  onCloseTab: (id: string) => void
  onNewSession: () => void
}

export function SessionSwitcher({
  tabs,
  activeTabId,
  onSwitchToTab,
  onCloseTab,
  onNewSession
}: SessionSwitcherProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to active tab
  useEffect(() => {
    const activeElement = scrollRef.current?.querySelector('[data-active="true"]')
    if (activeElement) {
      activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [activeTabId])

  return (
    <div className="flex items-center gap-1 flex-1 min-w-0 px-2 h-full">
      <div 
        ref={scrollRef}
        className="flex items-center gap-1 overflow-x-auto no-scrollbar h-full py-1.5"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          return (
            <div
              key={tab.id}
              data-active={isActive}
              onClick={() => onSwitchToTab(tab.id)}
              className={cn(
                "group relative flex items-center gap-2 px-3 py-1 rounded-md cursor-pointer transition-all duration-200 min-w-[120px] max-w-[200px] h-full",
                isActive 
                  ? "bg-white/10 text-white border border-white/10" 
                  : "bg-white/5 text-white/40 border border-transparent hover:bg-white/10 hover:text-white/80"
              )}
            >
              <TerminalIcon size={12} className={cn(isActive ? "text-primary" : "text-muted-foreground/60")} />
              
              <span className="text-xs font-medium truncate flex-1 select-none">
                {tab.title || 'Untitled Session'}
              </span>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCloseTab(tab.id)
                }}
                className={cn(
                  "opacity-0 group-hover:opacity-100 p-0.5 rounded-sm hover:bg-foreground/10 transition-all",
                  isActive && "opacity-100"
                )}
              >
                <X size={10} />
              </button>

              {isActive && (
                <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-primary rounded-t-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]" />
              )}
            </div>
          )
        })}
      </div>

      <button
        onClick={onNewSession}
        className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-all shrink-0"
        title="New Session"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
