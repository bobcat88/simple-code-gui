import React, { useCallback, useMemo, useState } from 'react'
import { Bot, Check, ChevronDown, ChevronRight, ExternalLink, FolderOpen, Terminal } from 'lucide-react'
import { useWorkspaceStore, type OpenTab, type Project } from '../../stores/workspace.js'
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
  return AGENT_BACKENDS.find((agent) => agent.id === backendId) ?? AGENT_BACKENDS[0]
}

function shortName(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).pop() || path
}

function groupTasksByProject(openTabs: OpenTab[]): Record<string, OpenTab[]> {
  return openTabs.reduce<Record<string, OpenTab[]>>((acc, tab) => {
    const key = tab.projectPath
    acc[key] = acc[key] ? [...acc[key], tab] : [tab]
    return acc
  }, {})
}

interface ProjectAssignmentRowProps {
  project: Project
  sessionCount: number
  onAssign: (projectPath: string, backend: BackendId) => void
  onOpenSession?: (projectPath: string) => void
}

function ProjectAssignmentRow({ project, sessionCount, onAssign, onOpenSession }: ProjectAssignmentRowProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const currentBackend = resolveBackend(project)
  const agentStyle = getAgentStyle(currentBackend)
  const projectName = project.name || shortName(project.path)
  const assignmentLabel = project.backend && project.backend !== 'default' ? 'Assigned' : 'Default'

  const handleSelect = useCallback((backend: BackendId) => {
    onAssign(project.path, backend)
    setDropdownOpen(false)
  }, [onAssign, project.path])

  const handleOpenSession = useCallback(() => {
    onOpenSession?.(project.path)
  }, [onOpenSession, project.path])

  return (
    <div className="rounded-xl border border-white/5 bg-black/10 p-3 transition-colors hover:bg-black/20">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color || '#6366f1' }} />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white/90">{projectName}</div>
              <div className="mt-0.5 truncate text-[10px] uppercase tracking-widest text-muted-foreground/80">
                {project.path}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest',
                  project.backend && project.backend !== 'default'
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/10 bg-white/5 text-muted-foreground'
                )}
              >
                {assignmentLabel}
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white/70">
                {sessionCount > 0 ? `${sessionCount} session${sessionCount === 1 ? '' : 's'}` : 'Idle'}
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {onOpenSession && (
              <button
                type="button"
                onClick={handleOpenSession}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/10"
                aria-label={`Open session for ${projectName}`}
              >
                <Terminal size={12} />
                Open
              </button>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen((value) => !value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all hover:brightness-125',
                  agentStyle.color
                )}
                aria-haspopup="menu"
                aria-expanded={dropdownOpen}
                aria-label={`Change agent for ${projectName}`}
              >
                <Bot size={12} />
                <span>{agentStyle.label}</span>
                <ChevronDown size={10} className={cn('transition-transform', dropdownOpen && 'rotate-180')} />
              </button>

              {dropdownOpen && (
                <>
                  <button
                    type="button"
                    aria-label={`Close agent menu for ${projectName}`}
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-xl"
                  >
                    {AGENT_BACKENDS.map((agent) => (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => handleSelect(agent.id)}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-white/10',
                          currentBackend === agent.id && 'bg-white/5'
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
        </div>
      </div>
    </div>
  )
}

interface TaskSessionRowProps {
  tab: OpenTab
  active: boolean
  onOpenSession?: (projectPath: string) => void
}

function TaskSessionRow({ tab, active, onOpenSession }: TaskSessionRowProps) {
  const projectName = shortName(tab.projectPath)
  const backendId = !tab.backend || tab.backend === 'default' ? 'claude' : tab.backend
  const backendLabel = getAgentStyle(backendId).label

  const handleOpen = useCallback(() => {
    onOpenSession?.(tab.projectPath)
  }, [onOpenSession, tab.projectPath])

  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-black/10 px-3 py-2.5">
      <div className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', active ? 'bg-emerald-400' : 'bg-white/20')} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white/90">{tab.title}</div>
            <div className="mt-0.5 truncate text-[10px] uppercase tracking-widest text-muted-foreground/80">
              {projectName} · {backendLabel}
            </div>
          </div>
          <span
            className={cn(
              'rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest',
              active ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-white/5 text-muted-foreground'
            )}
          >
            {active ? 'Active' : 'Open'}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {onOpenSession && (
            <button
              type="button"
              onClick={handleOpen}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/80 transition-colors hover:bg-white/10"
              aria-label={`Open task session ${tab.title}`}
            >
              <ExternalLink size={12} />
              Resume
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export interface TaskAssignmentViewProps {
  onOpenSession?: (projectPath: string) => void
}

export function TaskAssignmentView({ onOpenSession }: TaskAssignmentViewProps) {
  const { projects, openTabs, activeTabId, updateProject } = useWorkspaceStore()
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    repositories: true,
    tasks: true,
  })

  const handleAssign = useCallback((projectPath: string, backend: BackendId) => {
    updateProject(projectPath, { backend })
  }, [updateProject])

  const toggleGroup = useCallback((group: string) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }))
  }, [])

  const { assigned, unassigned } = useMemo(() => {
    const assigned: Project[] = []
    const unassigned: Project[] = []
    for (const project of projects) {
      if (project.backend && project.backend !== 'default') {
        assigned.push(project)
      } else {
        unassigned.push(project)
      }
    }
    return { assigned, unassigned }
  }, [projects])

  const groupedTasks = useMemo(() => groupTasksByProject(openTabs), [openTabs])

  const agentCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const project of projects) {
      const backend = resolveBackend(project)
      counts[backend] = (counts[backend] || 0) + 1
    }
    return counts
  }, [projects])

  const summaryCards = [
    { label: 'Repositories', value: projects.length },
    { label: 'Assigned', value: assigned.length },
    { label: 'Tasks', value: openTabs.length },
    { label: 'Active', value: openTabs.filter((tab) => tab.id === activeTabId).length },
  ]

  if (projects.length === 0 && openTabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 text-muted-foreground/30">
          <FolderOpen size={20} />
        </div>
        <p className="text-xs text-muted-foreground">No repositories or tasks are registered yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-white/5 bg-black/10 p-3">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{card.label}</div>
            <div className="mt-1 text-lg font-semibold text-white/90">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {AGENT_BACKENDS.filter((agent) => agentCounts[agent.id]).map((agent) => (
          <div
            key={agent.id}
            className={cn('flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium', agent.color)}
          >
            <Bot size={10} />
            <span>{agent.label}</span>
            <span className="opacity-60">x{agentCounts[agent.id]}</span>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <button
          type="button"
          onClick={() => toggleGroup('repositories')}
          className="flex w-full items-center gap-1 px-1 py-1 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-white/60"
        >
          {expandedGroups.repositories ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Repositories ({projects.length})
        </button>

        {expandedGroups.repositories && (
          <div className="space-y-2">
            {assigned.length > 0 && (
              <div className="space-y-2">
                <div className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
                  Assigned
                </div>
                {assigned.map((project) => (
                  <ProjectAssignmentRow
                    key={project.path}
                    project={project}
                    sessionCount={groupedTasks[project.path]?.length ?? 0}
                    onAssign={handleAssign}
                    onOpenSession={onOpenSession}
                  />
                ))}
              </div>
            )}

            {unassigned.length > 0 && (
              <div className="space-y-2">
                <div className="px-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
                  Default
                </div>
                {unassigned.map((project) => (
                  <ProjectAssignmentRow
                    key={project.path}
                    project={project}
                    sessionCount={groupedTasks[project.path]?.length ?? 0}
                    onAssign={handleAssign}
                    onOpenSession={onOpenSession}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <button
          type="button"
          onClick={() => toggleGroup('tasks')}
          className="flex w-full items-center gap-1 px-1 py-1 text-left text-xs font-bold uppercase tracking-widest text-muted-foreground transition-colors hover:text-white/60"
        >
          {expandedGroups.tasks ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Tasks ({openTabs.length})
        </button>

        {expandedGroups.tasks && (
          <div className="space-y-2">
            {openTabs.length > 0 ? (
              openTabs.map((tab) => (
                <TaskSessionRow
                  key={tab.id}
                  tab={tab}
                  active={tab.id === activeTabId}
                  onOpenSession={onOpenSession}
                />
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-white/10 bg-black/10 px-3 py-4 text-sm text-muted-foreground">
                No active task sessions.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
