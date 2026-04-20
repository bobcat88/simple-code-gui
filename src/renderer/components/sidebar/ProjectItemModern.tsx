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
      {showDropBefore && <div className="h-0.5 bg-primary rounded-full mb-1 mx-2 animate-pulse" />}

      <div
        className={cn(
          "relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200",
          "hover:bg-accent/40 hover:backdrop-blur-sm",
          isFocused ? "bg-accent/60 shadow-sm" : "bg-transparent",
          isDragging ? "opacity-50 scale-95" : "opacity-100 scale-100",
          hasOpenTab && "after:absolute after:left-0 after:top-1/4 after:bottom-1/4 after:w-1 after:bg-primary after:rounded-r-full"
        )}
        style={project.color ? { backgroundColor: `${project.color}15` } : undefined}
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
            "flex items-center justify-center w-5 h-5 rounded-md transition-colors",
            "hover:bg-accent text-muted-foreground",
            isExpanded && "text-foreground"
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
            <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              className="w-full bg-background border border-primary/30 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:border-primary shadow-sm"
              value={editingName}
              onChange={(e) => onEditingChange(e.target.value)}
              onKeyDown={onRenameKeyDown}
              onBlur={onRenameSubmit}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <div
              className="font-medium text-[13.5px] truncate text-foreground/90 group-hover/project:text-foreground transition-colors"
              title={project.name}
              onDoubleClick={onStartRename}
            >
              {project.name}
            </div>
          )}
          
          <div className="flex items-center gap-2 mt-0.5">
            {taskCounts ? (
              <span className={cn(
                "text-[11px] font-medium",
                (taskCounts.open + taskCounts.inProgress > 0) ? "text-primary/70" : "text-muted-foreground/60"
              )}>
                {taskCounts.open + taskCounts.inProgress} tasks
                {taskCounts.inProgress > 0 && <span className="ml-1 text-green-500/80">({taskCounts.inProgress} active)</span>}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground/50 truncate max-w-[120px]" title={project.path}>
                {project.path.split('/').pop()}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover/project:opacity-100 transition-opacity">
          {project.executable && (
            <button
              className="p-1 rounded-md hover:bg-green-500/20 text-green-500/70 hover:text-green-500 transition-all"
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
              className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
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
            className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
            onClick={(e) => {
              e.stopPropagation()
              onContextMenu(e)
            }}
          >
            <MoreVertical size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      {showDropAfter && <div className="h-0.5 bg-primary rounded-full mt-1 mx-2 animate-pulse" />}

      {isExpanded && (
        <div className="mt-1 ml-6 pl-4 border-l border-border/40 flex flex-col gap-0.5 animate-in slide-in-from-left-2 duration-200">
          <div
            className="flex items-center gap-3 px-3 py-1.5 rounded-lg cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-all group/new-session"
            onClick={(e) => {
              e.stopPropagation()
              onOpenSession(undefined, undefined, true)
            }}
          >
            <div className="w-5 h-5 flex items-center justify-center rounded-md bg-muted/50 group-hover/new-session:bg-primary/20 group-hover/new-session:text-primary transition-colors">
              <Plus size={12} strokeWidth={3} />
            </div>
            <span className="text-xs font-medium">New Session</span>
          </div>
          
          {sessions.map((session, index) => (
            <div
              key={session.sessionId}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all",
                "hover:bg-accent/40 group/session",
                index === 0 ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={(e) => {
                e.stopPropagation()
                onOpenSession(session.sessionId, session.slug)
              }}
              title={`Session ID: ${session.sessionId}`}
            >
              <div className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                index === 0 ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" : "bg-muted-foreground/30 group-hover/session:bg-muted-foreground/60"
              )} />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium truncate" title={session.slug}>
                  {session.slug}
                </div>
                <div className="text-[10px] text-muted-foreground/40 mt-0.5">
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
