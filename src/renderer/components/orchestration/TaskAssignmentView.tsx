import React, { useState, useMemo, useCallback } from 'react'
import { Bot, ChevronDown, ChevronRight, FolderOpen, Check } from 'lucide-react'
import { useWorkspaceStore, type Project } from '../../stores/workspace.js'
import { cn } from '../../lib/utils'
import type { BackendId } from '../../api/types.js'

const AGENT_BACKENDS: { id: BackendId; label: string; color: string }[] = [
  { id: 'claude', label: 'Claude', color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  { id: 'gemini', label: 'Gemini', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { id: 'codex', label: 'Codex', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { id: 'opencode', label: 'OpenCode', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { id: 'aider', label: 'Aider', color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
]

function resolveBackend(project: Project): BackendId {
  return (!project.backend || project.backend === 'default') ? 'claude' : project.backend
}

function getAgentStyle(backendId: BackendId) {
  return AGENT_BACKENDS.find(a => a.id === backendId) ?? AGENT_BACKENDS[0]
}

interface ProjectAssignmentRowProps {
  project: Project
  onAssign: (projectPath: string, backend: BackendId) => void
}

function ProjectAssignmentRow({ project, onAssign }: ProjectAssignmentRowProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const currentBackend = resolveBackend(project)
  const agentStyle = getAgentStyle(currentBackend)
  const projectName = project.name || project.path.split(/[/\\]/).pop() || project.path

  const handleSelect = useCallback((backend: BackendId) => {
    onAssign(project.path, backend)
    setDropdownOpen(false)
  }, [project.path, onAssign])

  return (
    <div className="flex items-center gap-2 p-2 rounded-xl hover:bg-white/5 transition-colors group">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: project.color || '#6366f1' }}
        />
        <span className="text-sm truncate text-white/80">{projectName}</span>
      </div>

      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all",
            agentStyle.color,
            "hover:brightness-125"
          )}
        >
          <Bot size={12} />
          <span>{agentStyle.label}</span>
          <ChevronDown size={10} className={cn("transition-transform", dropdownOpen && "rotate-180")} />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 w-40 py-1 rounded-xl bg-popover border border-border shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
              {AGENT_BACKENDS.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => handleSelect(agent.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/10 transition-colors",
                    currentBackend === agent.id && "bg-white/5"
                  )}
                >
                  <Bot size={12} className={agent.color.split(' ')[1]} />
                  <span className="flex-1 text-left">{agent.label}</span>
                  {currentBackend === agent.id && <Check size={12} className="text-primary" />}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export interface TaskAssignmentViewProps {
  onOpenSession?: (projectPath: string) => void
}

export function TaskAssignmentView({ onOpenSession }: TaskAssignmentViewProps) {
  const { projects, updateProject } = useWorkspaceStore()
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ unassigned: true, assigned: true })

  const handleAssign = useCallback((projectPath: string, backend: BackendId) => {
    updateProject(projectPath, { backend })
  }, [updateProject])

  const toggleGroup = useCallback((group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }))
  }, [])

  const { assigned, unassigned } = useMemo(() => {
    const assigned: Project[] = []
    const unassigned: Project[] = []
    for (const p of projects) {
      if (p.backend && p.backend !== 'default') {
        assigned.push(p)
      } else {
        unassigned.push(p)
      }
    }
    return { assigned, unassigned }
  }, [projects])

  const agentCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of projects) {
      const b = resolveBackend(p)
      counts[b] = (counts[b] || 0) + 1
    }
    return counts
  }, [projects])

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mb-3 text-muted-foreground/30">
          <FolderOpen size={20} />
        </div>
        <p className="text-xs text-muted-foreground">No projects yet. Add a project to assign agents.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Agent Distribution Summary */}
      <div className="flex flex-wrap gap-1.5">
        {AGENT_BACKENDS.filter(a => agentCounts[a.id]).map(agent => (
          <div
            key={agent.id}
            className={cn("flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border", agent.color)}
          >
            <Bot size={10} />
            <span>{agent.label}</span>
            <span className="opacity-60">×{agentCounts[agent.id]}</span>
          </div>
        ))}
      </div>

      {/* Explicitly Assigned */}
      {assigned.length > 0 && (
        <div>
          <button
            onClick={() => toggleGroup('assigned')}
            className="flex items-center gap-1 w-full text-left px-1 py-1 text-xs font-bold uppercase text-muted-foreground tracking-widest hover:text-white/60 transition-colors"
          >
            {expandedGroups.assigned ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Assigned ({assigned.length})
          </button>
          {expandedGroups.assigned && (
            <div className="space-y-0.5">
              {assigned.map(p => (
                <ProjectAssignmentRow key={p.path} project={p} onAssign={handleAssign} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Default / Unassigned */}
      {unassigned.length > 0 && (
        <div>
          <button
            onClick={() => toggleGroup('unassigned')}
            className="flex items-center gap-1 w-full text-left px-1 py-1 text-xs font-bold uppercase text-muted-foreground tracking-widest hover:text-white/60 transition-colors"
          >
            {expandedGroups.unassigned ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Default ({unassigned.length})
          </button>
          {expandedGroups.unassigned && (
            <div className="space-y-0.5">
              {unassigned.map(p => (
                <ProjectAssignmentRow key={p.path} project={p} onAssign={handleAssign} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
