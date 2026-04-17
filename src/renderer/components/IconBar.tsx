import React from 'react'
import { 
  LayoutGrid, 
  Settings, 
  Terminal, 
  HelpCircle, 
  FolderOpen,
  User,
  Cpu
} from 'lucide-react'
import { cn } from '../lib/utils'

export interface IconBarProps {
  activeSection: string
  onSectionChange: (section: string) => void
}

export function IconBar({ activeSection, onSectionChange }: IconBarProps) {
  const items = [
    { id: 'projects', icon: FolderOpen, label: 'Projects' },
    { id: 'terminal', icon: Terminal, label: 'Sessions' },
    { id: 'plugins', icon: Cpu, label: 'Plugins' },
    { id: 'config', icon: Settings, label: 'Settings' },
    { id: 'help', icon: HelpCircle, label: 'Help' },
  ]

  return (
    <div className="w-16 flex flex-col items-center py-6 bg-background/60 backdrop-blur-xl border-r border-border/50 h-full gap-2 z-20">
      <div className="mb-6 px-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-primary/60 flex items-center justify-center text-primary-foreground shadow-xl shadow-primary/20 cursor-pointer hover:scale-110 transition-transform duration-300 group">
          <Cpu size={22} strokeWidth={2.5} className="group-hover:rotate-12 transition-transform" />
        </div>
      </div>
      
      <div className="flex flex-col gap-2 w-full px-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            className={cn(
              "p-3 rounded-2xl transition-all duration-300 group relative flex items-center justify-center w-full",
              activeSection === item.id 
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-100" 
                : "text-muted-foreground hover:bg-muted/80 hover:text-foreground scale-95 hover:scale-100"
            )}
            title={item.label}
          >
            <item.icon size={20} strokeWidth={activeSection === item.id ? 2.5 : 2} />
            
            {/* Tooltip hint for collapsed state */}
            <div className="absolute left-full ml-3 px-2 py-1 bg-popover text-popover-foreground text-[10px] font-bold uppercase tracking-widest rounded-md opacity-0 pointer-events-none group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all z-50 shadow-xl border border-border">
              {item.label}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-4 w-full px-2 pb-2">
        <button className="p-3 rounded-2xl text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all flex items-center justify-center group relative">
          <User size={20} />
          <div className="absolute left-full ml-3 px-2 py-1 bg-popover text-popover-foreground text-[10px] font-bold uppercase tracking-widest rounded-md opacity-0 pointer-events-none group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all z-50 shadow-xl border border-border">
            Profile
          </div>
        </button>
      </div>
    </div>
  )
}
