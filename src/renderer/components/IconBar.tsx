import React from 'react'
import { 
  Settings, 
  Terminal, 
  HelpCircle, 
  FolderOpen,
  Cpu,
  Layers
} from 'lucide-react'
import { cn } from '../lib/utils'

export interface IconBarProps {
  activeSection: string
  onSectionChange: (section: string) => void
  activeTabId: string | null
  focusedTabId: string | null
  onOpenSettings: () => void
}

export function IconBar({ 
  activeSection, 
  onSectionChange,
  activeTabId,
  focusedTabId,
  onOpenSettings
}: IconBarProps) {
  const items = [
    { id: 'projects', icon: FolderOpen, label: 'Projects' },
    { id: 'terminal', icon: Terminal, label: 'Sessions' },
    { id: 'orchestration', icon: Layers, label: 'Orchestration' },
    { id: 'plugins', icon: Cpu, label: 'Plugins' },
  ]

  return (
    <div className="w-16 flex flex-col items-center py-6 bg-background/20 backdrop-blur-xl border-r border-white/5 h-full gap-2 z-20">
      <div className="mb-6 px-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-primary/60 flex items-center justify-center text-primary-foreground shadow-xl shadow-primary/20 cursor-pointer hover:scale-105 transition-all duration-300 group">
          <Cpu size={20} strokeWidth={2.5} className="group-hover:rotate-12 transition-transform" />
        </div>
      </div>
      
      <div className="flex flex-col gap-2 w-full px-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            className={cn(
              "p-3 rounded-xl transition-all duration-200 group relative flex items-center justify-center w-full",
              activeSection === item.id 
                ? "bg-white/10 text-white shadow-sm" 
                : "text-white/40 hover:bg-white/5 hover:text-white/80"
            )}
            title={item.label}
          >
            <item.icon size={20} strokeWidth={activeSection === item.id ? 2 : 1.5} />
            
            <div className="absolute left-full ml-3 px-2 py-1 bg-popover text-popover-foreground text-[10px] font-bold uppercase tracking-widest rounded-md opacity-0 pointer-events-none group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all z-50 shadow-xl border border-border">
              {item.label}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-2 w-full px-2 pb-2">
        <button 
          onClick={onOpenSettings}
          className={cn(
            "p-3 rounded-xl transition-all duration-200 group relative flex items-center justify-center w-full",
            activeSection === 'config'
              ? "bg-white/10 text-white" 
              : "text-white/40 hover:bg-white/5 hover:text-white/80"
          )}
          title="Settings"
        >
          <Settings size={20} />
          <div className="absolute left-full ml-3 px-2 py-1 bg-popover text-popover-foreground text-[10px] font-bold uppercase tracking-widest rounded-md opacity-0 pointer-events-none group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all z-50 shadow-xl border border-border">
            Settings
          </div>
        </button>
      </div>
    </div>
  )
}
