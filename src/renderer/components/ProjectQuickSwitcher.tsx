import React, { useState, useEffect, useMemo, useRef } from 'react'
import { FolderOpen, Clock, ArrowRight } from 'lucide-react'
import { cn } from '../lib/utils'
import { Project } from '../stores/workspace'

interface ProjectQuickSwitcherProps {
  isOpen: boolean
  onClose: () => void
  projects: Project[]
  activeProjectPath: string | null
  onOpenSession: (path: string) => void
}

export function ProjectQuickSwitcher({
  isOpen,
  onClose,
  projects,
  activeProjectPath,
  onOpenSession
}: ProjectQuickSwitcherProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
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

  const sortedProjects = useMemo(() => {
    const q = query.toLowerCase()

    // Sort by recency (lastAccessedAt), then alphabetical
    const sorted = [...projects].sort((a, b) => {
      const aTime = a.lastAccessedAt || 0
      const bTime = b.lastAccessedAt || 0
      if (aTime !== bTime) return bTime - aTime
      return (a.name || '').localeCompare(b.name || '')
    })

    // Filter out active project — switcher is for switching away
    const filtered = sorted.filter(p => p.path !== activeProjectPath)

    if (!q) return filtered

    return filtered.filter(p => {
      const name = (p.name || '').toLowerCase()
      const path = p.path.toLowerCase()
      return name.includes(q) || path.includes(q)
    }).sort((a, b) => {
      // Boost title-start matches
      const aName = (a.name || '').toLowerCase()
      const bName = (b.name || '').toLowerCase()
      const aStarts = aName.startsWith(q)
      const bStarts = bName.startsWith(q)
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1
      return 0
    })
  }, [query, projects, activeProjectPath])

  useEffect(() => {
    setSelectedIndex(0)
  }, [sortedProjects])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => sortedProjects.length > 0 ? (prev + 1) % sortedProjects.length : 0)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => sortedProjects.length > 0 ? (prev - 1 + sortedProjects.length) % sortedProjects.length : 0)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (sortedProjects[selectedIndex]) {
        onOpenSession(sortedProjects[selectedIndex].path)
        onClose()
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const formatRecency = (timestamp?: number): string => {
    if (!timestamp) return ''
    const diff = Date.now() - timestamp
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  if (!isOpen) return null

  return (
    <div className="spotlight-overlay">
      <div ref={containerRef} className="spotlight-container glass-panel">
        <div className="flex items-center px-5 py-4 border-b border-white/10">
          <FolderOpen size={22} className="text-white/30 mr-4" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Switch to project..."
            className="flex-1 bg-transparent border-none text-xl outline-none text-white placeholder:text-white/10"
          />
          <div className="flex items-center gap-1 ml-4 opacity-40">
            <span className="text-xs font-bold">Ctrl</span>
            <span className="text-xs font-bold">Tab</span>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto py-2 custom-scrollbar">
          {sortedProjects.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-white/40 italic mb-2">
                {query ? `No projects matching "${query}"` : 'No other projects available'}
              </div>
              <div className="text-[10px] text-white/20 uppercase tracking-widest">
                {query ? 'Try a different search' : 'Add projects from the sidebar'}
              </div>
            </div>
          ) : (
            sortedProjects.map((project, idx) => (
              <div
                key={project.path}
                className={cn(
                  "px-5 py-3 cursor-pointer flex items-center group transition-all duration-200 mx-2 rounded-xl mb-1",
                  idx === selectedIndex ? "bg-white/15 shadow-lg scale-[1.02] translate-x-1" : "hover:bg-white/5"
                )}
                onMouseEnter={() => setSelectedIndex(idx)}
                onClick={() => { onOpenSession(project.path); onClose() }}
              >
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center mr-4 transition-all duration-300",
                  idx === selectedIndex ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]" : "bg-white/5 text-white/40"
                )}>
                  {project.color ? (
                    <div className="w-5 h-5 rounded-full" style={{ backgroundColor: project.color }} />
                  ) : (
                    <FolderOpen size={16} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-[15px] font-medium text-white truncate">
                      {project.name || project.path.split('/').pop() || 'Untitled'}
                    </div>
                  </div>
                  <div className="text-xs text-white/25 truncate mt-0.5">{project.path}</div>
                </div>
                {project.lastAccessedAt && (
                  <div className="flex items-center gap-1.5 text-[10px] text-white/20 ml-2 shrink-0">
                    <Clock size={10} />
                    {formatRecency(project.lastAccessedAt)}
                  </div>
                )}
                {idx === selectedIndex && (
                  <ArrowRight size={14} className="text-white/30 ml-2 shrink-0" />
                )}
              </div>
            ))
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
              Open
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
