import React, { useMemo } from 'react'
import type { UnifiedTask } from './adapters/types.js'
import { getPriorityClass, PRIORITY_LABELS, formatStatusLabel, getStatusOrder } from './types.js'
import { TaskStatusButton } from './TaskStatusButton.js'

interface BeadsTaskListProps {
  tasks: UnifiedTask[]
  panelHeight: number
  editingTaskId: string | null
  editingTitle: string
  editInputRef: React.RefObject<HTMLInputElement>
  onComplete: (taskId: string) => void
  onStart: (e: React.MouseEvent, taskId: string) => void
  onCycleStatus: (taskId: string, currentStatus: string) => void
  onChangePriority: (taskId: string, priority: number) => void
  onDelete: (taskId: string) => void
  onOpenDetail: (task: UnifiedTask) => void
  setEditingTitle: (title: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
}

export function BeadsTaskList({
  tasks,
  panelHeight,
  editingTaskId,
  editingTitle,
  editInputRef,
  onComplete,
  onStart,
  onCycleStatus,
  onChangePriority,
  onDelete,
  onOpenDetail,
  setEditingTitle,
  onSaveEdit,
  onCancelEdit
}: BeadsTaskListProps): React.ReactElement {
  const sortedTasks = useMemo(() =>
    [...tasks].sort((a, b) => {
      // Completed tasks go last
      const statusDiff = getStatusOrder(a.status) - getStatusOrder(b.status)
      if (statusDiff !== 0) return statusDiff
      // Then sort by priority (lower number = higher priority)
      return (a.priority ?? 2) - (b.priority ?? 2)
    }),
    [tasks]
  )

  if (tasks.length === 0) {
    return (
      <div className="beads-tasks" style={{ maxHeight: `${panelHeight}px` }}>
        <div className="beads-empty">No ready tasks</div>
      </div>
    )
  }

  return (
    <div className="beads-tasks" style={{ maxHeight: `${panelHeight}px` }}>
      {sortedTasks.map((task) => (
        <div key={task.id} className={`beads-task ${getPriorityClass(task.priority)} status-${task.status}`}>
          <TaskStatusButton
            status={task.status}
            taskId={task.id}
            onComplete={onComplete}
            onStart={onStart}
          />
          <div className="beads-task-content">
            {editingTaskId === task.id ? (
              <input
                ref={editInputRef}
                className="beads-task-edit-input"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onSaveEdit()
                  }
                  if (e.key === 'Escape') onCancelEdit()
                }}
                onBlur={onSaveEdit}
              />
            ) : (
              <div
                className={`beads-task-title clickable ${task.status === 'closed' ? 'completed' : ''}`}
                title="Click to view details"
                onClick={() => onOpenDetail(task)}
              >
                {task.title}
              </div>
            )}
            <div className="beads-task-meta">
              <select
                className={`beads-task-priority-select ${getPriorityClass(task.priority)}`}
                value={task.priority ?? 2}
                onChange={(e) => {
                  e.stopPropagation()
                  onChangePriority(task.id, Number(e.target.value))
                }}
                onClick={(e) => e.stopPropagation()}
                title="Change priority"
              >
                {PRIORITY_LABELS.map((label, i) => (
                  <option key={i} value={i}>P{i}</option>
                ))}
              </select>
              <span className="beads-task-id" title={task.id}>{task.displayId ?? task.id}</span>
              
              {/* Source Backend */}
              <span className={`beads-task-backend backend-${task._backend}`} title={`Backend: ${task._backend}`}>
                {task._backend}
              </span>

              {/* Spec & AC Indicator */}
              {task.hasSpec && (
                <span className="beads-task-spec-badge" title={task.specItems?.[0]?.title || 'Has linked spec'}>
                  {task.acceptanceCriteria ? (
                    `${task.acceptanceCriteria.filter(ac => ac.status === 'satisfied').length}/${task.acceptanceCriteria.length} AC`
                  ) : 'SPEC'}
                </span>
              )}

              {/* Validation Indicator */}
              {task.validation && (
                <span className={`beads-task-validation val-${task.validation.status}`} title={`Validation: ${task.validation.status}`}>
                  {task.validation.status === 'passed' ? '✓' : task.validation.status === 'failed' ? '✗' : '!'}
                </span>
              )}

              {/* Traits (capped to 2) */}
              {task.traits && task.traits.length > 0 && (
                <div className="beads-task-traits">
                  {task.traits.slice(0, 2).map(trait => (
                    <span key={trait.id} className="beads-task-trait-chip">{trait.label}</span>
                  ))}
                  {task.traits.length > 2 && (
                    <span className="beads-task-trait-overflow">+{task.traits.length - 2}</span>
                  )}
                </div>
              )}

              {task.automation && (
                <span className={`beads-task-automation automation-${task.automation}`} title={`Automation: ${task.automation}`}>
                  {task.automation === 'eligible' ? 'auto' : task.automation === 'needs_review' ? 'review' : 'manual'}
                </span>
              )}

              <button
                className={`beads-task-status status-${task.status}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onCycleStatus(task.id, task.status)
                }}
                title="Click to cycle status"
              >
                {formatStatusLabel(task.status)}
              </button>
            </div>
          </div>
          <button
            className="beads-task-delete"
            onClick={() => onDelete(task.id)}
            title="Delete task"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
