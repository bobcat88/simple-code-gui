import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Search, Terminal, Settings, Plus, LayoutGrid, Command as CommandIcon, Brain, Sparkles, FileText } from 'lucide-react'
import { cn } from '../lib/utils'
import { Project } from '../stores/workspace'
import { ExtendedApi, VectorSearchResult } from '../api/types'

interface SpotlightProps {
  isOpen: boolean
  onClose: () => void
  projects: Project[]
  openTabs: any[]
  onOpenSession: (path: string) => void
  onOpenSettings: () => void
  onOpenProjectWizard: () => void
  onSwitchToTab: (id: string) => void
  api: ExtendedApi
}

interface SpotlightResult {
  id: string
  title: string
  subtitle?: string
  type: 'command' | 'project' | 'tab' | 'mcp' | 'neural'
  icon: React.ReactNode
  action: () => void
  shortcut?: string
  score?: number
}

export function Spotlight({ 
  isOpen, 
  onClose, 
  projects, 
  openTabs, 
  onOpenSession, 
  onOpenSettings, 
  onOpenProjectWizard,
  onSwitchToTab,
  api
}: SpotlightProps) {
  const [query, setQuery] = useState('')
  const [semanticResults, setSemanticResults] = useState<SpotlightResult[]>([])
  const [isSearchingSemantic, setIsSearchingSemantic] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      // Small delay to ensure the animation has started or the element is mounted
      const timer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  // Semantic Search Effect
  useEffect(() => {
    if (!query || query.length < 3) {
      setSemanticResults([])
      return
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearchingSemantic(true)
      try {
        const results = await api.vectorSearch(query, 5)
        const neuralItems: SpotlightResult[] = results.map((res: VectorSearchResult) => ({
          id: `neural-${res.chunk.id}`,
          title: res.chunk.content.length > 60 ? res.chunk.content.substring(0, 60) + '...' : res.chunk.content,
          subtitle: `${res.chunk.metadata?.file_path || res.chunk.filePath || 'Global Knowledge'} • ${Math.round(res.score * 100)}% match`,
          type: 'neural' as const,
          icon: (res.chunk.metadata?.file_path || res.chunk.filePath) ? <FileText size={16} /> : <Brain size={16} />,
          action: () => {
            // If it's a file, we could potentially open it in the future
            // For now, just log it or show a toast
            console.log('Selected semantic result:', res)
          },
          score: res.score
        }))
        setSemanticResults(neuralItems)
      } catch (err) {
        console.error('Spotlight semantic search failed:', err)
      } finally {
        setIsSearchingSemantic(false)
      }
    }, 300)

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    }
  }, [query, api])

  const results = useMemo(() => {
    const q = query.toLowerCase()
    
    const allItems: SpotlightResult[] = [
      // Commands
      { 
        id: 'new-project', 
        title: 'New Project', 
        type: 'command', 
        icon: <Plus size={16} />, 
        action: onOpenProjectWizard,
        shortcut: 'Cmd+N'
      },
      { 
        id: 'settings', 
        title: 'Settings', 
        type: 'command', 
        icon: <Settings size={16} />, 
        action: onOpenSettings,
        shortcut: 'Cmd+,'
      },
      
      // Projects
      ...projects.map(p => ({
        id: `project-${p.path}`,
        title: p.name || p.path.split('/').pop() || 'Untitled Project',
        subtitle: p.path,
        type: 'project' as const,
        icon: <LayoutGrid size={16} />,
        action: () => onOpenSession(p.path)
      })),
      
      // Tabs
      ...openTabs.map(t => ({
        id: `tab-${t.id}`,
        title: t.title,
        subtitle: `Switch to active session: ${t.projectPath}`,
        type: 'tab' as const,
        icon: <Terminal size={16} />,
        action: () => onSwitchToTab(t.id)
      })),

      // Neural Results
      ...semanticResults
    ]
    
    if (!q) return allItems.slice(0, 8) // Show defaults if no query
    
    return allItems.filter(item => 
      item.title.toLowerCase().includes(q) || 
      (item.subtitle && item.subtitle.toLowerCase().includes(q))
    ).sort((a, b) => {
      // Prioritize exact matches or title matches
      const aTitleMatch = a.title.toLowerCase().startsWith(q)
      const bTitleMatch = b.title.toLowerCase().startsWith(q)
      if (aTitleMatch && !bTitleMatch) return -1
      if (!aTitleMatch && bTitleMatch) return 1
      return 0
    })
  }, [query, projects, openTabs, onOpenProjectWizard, onOpenSettings, onOpenSession, onSwitchToTab, semanticResults])

  // Update selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (results.length > 0 ? (prev + 1) % results.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIndex]) {
        results[selectedIndex].action()
        onClose()
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="spotlight-overlay">
      <div ref={containerRef} className="spotlight-container glass-panel">
        <div className="flex items-center px-5 py-4 border-b border-white/10">
          <Search size={22} className="text-white/30 mr-4" />
          <input 
            ref={inputRef}
            type="text" 
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search projects, tabs, or ask a question..."
            className="flex-1 bg-transparent border-none text-xl outline-none text-white placeholder:text-white/10"
          />
          {isSearchingSemantic && (
            <Sparkles size={18} className="text-purple-400 animate-pulse mr-4" />
          )}
          <div className="flex items-center gap-1 ml-4 opacity-40">
            <CommandIcon size={14} />
            <span className="text-xs font-bold">K</span>
          </div>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto py-2 custom-scrollbar">
          {query && results.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-white/40 italic mb-2">No results found for "{query}"</div>
              <div className="text-[10px] text-white/20 uppercase tracking-widest">Try a different search term</div>
            </div>
          ) : (
            <>
              {results.map((result, idx) => (
                <div 
                  key={result.id}
                  className={cn(
                    "px-5 py-3 cursor-pointer flex items-center group transition-all duration-200 mx-2 rounded-xl mb-1",
                    idx === selectedIndex ? "bg-white/15 shadow-lg scale-[1.02] translate-x-1" : "hover:bg-white/5"
                  )}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => { result.action(); onClose(); }}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center mr-4 transition-all duration-300",
                    idx === selectedIndex ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]" : "bg-white/5 text-white/40"
                  )}>
                    {result.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="text-[15px] font-medium text-white truncate">{result.title}</div>
                      <div className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded uppercase font-bold tracking-tighter",
                        result.type === 'command' ? "bg-blue-500/20 text-blue-400" :
                        result.type === 'project' ? "bg-purple-500/20 text-purple-400" :
                        result.type === 'neural' ? "bg-pink-500/20 text-pink-400" :
                        "bg-emerald-500/20 text-emerald-400"
                      )}>
                        {result.type}
                      </div>
                    </div>
                    {result.subtitle && (
                      <div className="text-xs text-white/25 truncate mt-0.5">{result.subtitle}</div>
                    )}
                  </div>
                  {result.shortcut && (
                    <div className="text-[10px] text-white/20 border border-white/10 px-2 py-0.5 rounded font-mono group-hover:text-white/40 transition-colors">
                      {result.shortcut}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
        
        <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between text-[10px] text-white/20 font-medium">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded shadow-sm text-[9px]">↑↓</kbd> 
              Navigate
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded shadow-sm text-[9px]">↵</kbd> 
              Select
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded shadow-sm text-[9px]">ESC</kbd> 
              Close
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
