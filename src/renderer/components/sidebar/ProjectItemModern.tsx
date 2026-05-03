import React from 'react'
import { Project } from '../../stores/workspace.js'
import { ProjectIcon } from '../ProjectIcon.js'
import { ClaudeSession, DropTarget } from './types.js'
import { formatDate } from './utils.js'
import { ChevronRight, ChevronDown, Play, X, MoreVertical, Plus } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ProjectItemModernProps {
  project: Project
  isExpanded: boolean
  isFocused: boolean
  hasOpenTab: boolean
  isDragging: boolean
  isEditing: boolean
  editingName: string
  sessions: ClaudeSession[]
  taskCounts?: { open: number; inProgress: number }
  dropTarget: DropTarget | null
  editInputRef: React.RefObject<HTMLInputElement>
  onToggleExpand: (e: React.MouseEvent) => void
  onOpenSession: (sessionId?: string, slug?: string, isNewSession?: boolean) => void
  onRunExecutable: () => void
  onCloseProjectTabs: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onStartRename: (e: React.MouseEvent) => void
  onEditingChange: (name: string) => void
  onRenameSubmit: () => void
  onRenameKeyDown: (e: React.KeyboardEvent) => void
}

export const ProjectItemModern = React.memo(function ProjectItemModern({
  project,
  isExpanded,
  isFocused,
  hasOpenTab,
  isDragging,
  isEditing,
  editingName,
  sessions,
  taskCounts,
  dropTarget,
  editInputRef,
  onToggleExpand,
  onOpenSession,
  onRunExecutable,
  onCloseProjectTabs,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onStartRename,
  onEditingChange,
  onRenameSubmit,
  onRenameKeyDown,
}: ProjectItemModernProps) {
  const showDropBefore = dropTarget?.type === 'project' && dropTarget.id === project.path && dropTarget.position === 'before'
  const showDropAfter = dropTarget?.type === 'project' && dropTarget.id === project.path && dropTarget.position === 'after'

  return (
    <div className="group/project">
      {showDropBefore && <div className="h-0.5 bg-codex-blue rounded-full mb-1 mx-2 animate-pulse shadow-[0_0_8px_var(--codex-blue-glow)]" />}

      <div
        className={cn(
          "relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-300",
          "hover:bg-white/[0.04] hover:backdrop-blur-md hover:border-white/5 border border-transparent",
          isFocused ? "bg-white/[0.06] border-white/10 shadow-sm" : "bg-transparent",
          isDragging ? "opacity-50 scale-95" : "opacity-100 scale-100",
          hasOpenTab && "after:absolute after:left-0 after:top-1/4 after:bottom-1/4 after:w-1 after:bg-codex-blue after:rounded-r-full after:shadow-[0_0_10px_var(--codex-blue-glow)]"
        )}
        style={project.color ? { backgroundColor: `${project.color}10` } : undefined}
        draggable={!isEditing}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onClick={() => onOpenSession()}
        onContextMenu={onContextMenu}
      >
        <button
          className={cn(
            "flex items-center justify-center w-5 h-5 rounded-md transition-all",
            "hover:bg-white/10 text-zinc-500 hover:text-zinc-100",
            isExpanded && "text-zinc-100 bg-white/5"
          )}
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand(e)
          }}
          title="Show all sessions"
        >
          {isExpanded ? <ChevronDown size={14} strokeWidth={2.5} /> : <ChevronRight size={14} strokeWidth={2.5} />}
        </button>

        <div className="relative">
          <ProjectIcon projectName={project.name} size={24} />
          {project.executable && (
            <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-codex-emerald rounded-full border-2 border-codex-dark shadow-[0_0_8px_var(--codex-emerald-glow)]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              className="w-full bg-black/60 border border-codex-blue/40 rounded-xl px-2 py-1 text-sm focus:outline-none focus:border-codex-blue shadow-[0_0_12px_var(--codex-blue-glow)] text-white"
              value={editingName}
              onChange={(e) => onEditingChange(e.target.value)}
              onKeyDown={onRenameKeyDown}
              onBlur={onRenameSubmit}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <div
              className="font-semibold text-[13.5px] tracking-tight truncate text-zinc-100 group-hover/project:text-white transition-colors"
              title={project.name}
              onDoubleClick={onStartRename}
            >
              {project.name}
            </div>
          )}
          
          <div className="flex items-center gap-2 mt-0.5">
            {taskCounts ? (
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-widest",
                (taskCounts.open + taskCounts.inProgress > 0) ? "text-codex-blue/80" : "text-zinc-500/60"
              )}>
                {taskCounts.open + taskCounts.inProgress} tasks
                {taskCounts.inProgress > 0 && <span className="ml-1 text-codex-emerald/80">({taskCounts.inProgress} active)</span>}
              </span>
            ) : (
              <span className="text-[10px] uppercase tracking-widest text-zinc-500/50 truncate max-w-[120px]" title={project.path}>
                {project.path.split('/').pop()}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover/project:opacity-100 transition-all duration-200 transform translate-x-1 group-hover/project:translate-x-0">
          {project.executable && (
            <button
              className="p-1.5 rounded-lg hover:bg-codex-emerald/20 text-codex-emerald/60 hover:text-codex-emerald transition-all shadow-sm"
              onClick={(e) => {
                e.stopPropagation()
                onRunExecutable()
              }}
              title={`Run: ${project.executable}`}
            >
              <Play size={12} strokeWidth={2.5} fill="currentColor" />
            </button>
          )}
          {hasOpenTab && (
            <button
              className="p-1.5 rounded-lg hover:bg-rose-500/10 text-zinc-500 hover:text-rose-400 transition-all"
              onClick={(e) => {
                e.stopPropagation()
                onCloseProjectTabs()
              }}
              title="Close all terminals"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          )}
          <button
            className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-zinc-100 transition-all"
            onClick={(e) => {
              e.stopPropagation()
              onContextMenu(e)
            }}
          >
            <MoreVertical size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      {showDropAfter && <div className="h-0.5 bg-codex-blue rounded-full mt-1 mx-2 animate-pulse shadow-[0_0_8px_var(--codex-blue-glow)]" />}

      {isExpanded && (
        <div className="mt-1 ml-6 pl-4 border-l border-white/5 flex flex-col gap-0.5 animate-in slide-in-from-left-2 duration-300">
          <div
            className="flex items-center gap-3 px-3 py-1.5 rounded-xl cursor-pointer text-zinc-500 hover:text-zinc-100 hover:bg-white/5 transition-all group/new-session"
            onClick={(e) => {
              e.stopPropagation()
              onOpenSession(undefined, undefined, true)
            }}
          >
            <div className="w-5 h-5 flex items-center justify-center rounded-xl bg-white/5 group-hover/new-session:bg-codex-blue/20 group-hover/new-session:text-codex-blue transition-all">
              <Plus size={12} strokeWidth={3} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-widest">New Session</span>
          </div>
          
          {sessions.map((session, index) => (
            <div
              key={session.sessionId}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all duration-200",
                "hover:bg-white/5 group/session",
                index === 0 ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-100"
              )}
              onClick={(e) => {
                e.stopPropagation()
                onOpenSession(session.sessionId, session.slug)
              }}
              title={`Session ID: ${session.sessionId}`}
            >
              <div className={cn(
                "w-1.5 h-1.5 rounded-full transition-all duration-300",
                index === 0 ? "bg-codex-blue shadow-[0_0_10px_var(--codex-blue-glow)] scale-110" : "bg-zinc-700 group-hover/session:bg-zinc-500"
              )} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate" title={session.slug}>
                  {session.slug}
                </div>
                <div className="text-[10px] font-medium text-zinc-600 mt-0.5">
                  {formatDate(session.lastModified)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

})
