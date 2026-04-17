import React from 'react'
import { 
  LayoutGrid, 
  Settings, 
  Terminal, 
  HelpCircle, 
  FolderOpen,
  User
} from 'lucide-react'
import { cn } from '../utils/cn'

export interface IconBarProps {
  activeSection: string
  onSectionChange: (section: string) => void
}

export function IconBar({ activeSection, onSectionChange }: IconBarProps) {
  const items = [
    { id: 'projects', icon: FolderOpen, label: 'Projects' },
    { id: 'terminal', icon: Terminal, label: 'Terminal' },
    { id: 'config', icon: Settings, label: 'Config' },
    { id: 'help', icon: HelpCircle, label: 'Help' },
  ]

  return (
    <div className="w-14 flex flex-col items-center py-4 bg-background border-r border-border h-full gap-4 z-20">
      <div className="mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
          <Terminal size={24} strokeWidth={2.5} />
        </div>
      </div>
      
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSectionChange(item.id)}
          className={cn(
            "p-2.5 rounded-lg transition-all duration-200 group relative",
            activeSection === item.id 
              ? "bg-primary/10 text-primary" 
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
          title={item.label}
        >
          <item.icon size={22} />
          {activeSection === item.id && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-primary rounded-r-full" />
          )}
        </button>
      ))}

      <div className="mt-auto flex flex-col gap-4">
        <button className="p-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
          <User size={22} />
        </button>
      </div>
    </div>
  )
}
