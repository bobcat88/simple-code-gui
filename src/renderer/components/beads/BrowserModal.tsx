import React from 'react'
import ReactDOM from 'react-dom'
import type { UnifiedTask } from './adapters/types.js'
import { getPriorityClass, getPriorityLabel, PRIORITY_LABELS, formatStatusLabel, getStatusOrder } from './types.js'

export type BrowserFilter = 'all' | 'open' | 'in_progress' | 'closed' | 'spec_linked' | 'missing_ac' | 'validation_failed' | 'automation_eligible'

interface BrowserModalProps {
  show: boolean
  onClose: () => void
  projectName: string | null
  backendLabel: string
  tasks: UnifiedTask[]
  filter: BrowserFilter
  setFilter: (filter: BrowserFilter) => void
  sort: 'priority' | 'created' | 'status'
  setSort: (sort: 'priority' | 'created' | 'status') => void
  onRefresh: () => void
  onCreateNew: () => void
  onComplete: (taskId: string) => void
  onStart: (e: React.MouseEvent, taskId: string) => void
  onCycleStatus: (taskId: string, status: string) => void
  onChangePriority: (taskId: string, priority: number) => void
  onDelete: (taskId: string) => void
  onOpenDetail: (task: UnifiedTask) => void
  onClearCompleted: () => void
}

export function BrowserModal({
  show, onClose, projectName, backendLabel, tasks,
  filter, setFilter, sort, setSort,
  onRefresh, onCreateNew, onComplete, onStart,
  onCycleStatus, onChangePriority, onDelete, onOpenDetail, onClearCompleted
}: BrowserModalProps) {
  if (!show) return null

  const getFilteredTasks = () => {
    let filtered = [...tasks]

    if (filter === 'open' || filter === 'in_progress' || filter === 'closed') {
      filtered = filtered.filter(t => t.status === filter)
    } else if (filter === 'spec_linked') {
      filtered = filtered.filter(t => (t.specItems && t.specItems.length > 0) || t.hasSpec)
    } else if (filter === 'missing_ac') {
      filtered = filtered.filter(t => (!t.acceptanceCriteria || t.acceptanceCriteria.length === 0) && t.source?.supportsAcceptanceCriteria)
    } else if (filter === 'validation_failed') {
      filtered = filtered.filter(t => t.validation?.status === 'failed')
    } else if (filter === 'automation_eligible') {
      filtered = filtered.filter(t => t.automation === 'eligible')
    }

    filtered.sort((a, b) => {
      if (sort === 'priority') {
        return (a.priority ?? 2) - (b.priority ?? 2)
      }
      if (sort === 'status') {
        return getStatusOrder(a.status) - getStatusOrder(b.status)
      }
      if (sort === 'created') {
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0
        return bDate - aDate
      }
      return 0
    })

    return filtered
  }

  const filteredTasks = getFilteredTasks()

  return ReactDOM.createPortal(
    <div className="beads-modal-overlay" onClick={onClose}>
      <div className="beads-browser-modal" onClick={(e) => e.stopPropagation()}>
        <div className="beads-browser-header">
          <div className="beads-browser-title-row">
            <span className="beads-icon">&#128255;</span>
            <h2>{backendLabel} Tasks</h2>
            <span className="beads-browser-project">{projectName}</span>
          </div>
          <button className="beads-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="beads-browser-toolbar">
          <div className="beads-browser-filters">
            <label>Filter:</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value as BrowserFilter)}>
              <option value="all">All ({tasks.length})</option>
              <optgroup label="Status">
                <option value="open">Open ({tasks.filter(t => t.status === 'open').length})</option>
                <option value="in_progress">In Progress ({tasks.filter(t => t.status === 'in_progress').length})</option>
                <option value="closed">Closed ({tasks.filter(t => t.status === 'closed').length})</option>
              </optgroup>
              <optgroup label="Spec Compliance">
                <option value="spec_linked">Linked to Spec ({tasks.filter(t => (t.specItems && t.specItems.length > 0) || t.hasSpec).length})</option>
                <option value="missing_ac">Missing AC ({tasks.filter(t => (!t.acceptanceCriteria || t.acceptanceCriteria.length === 0) && t.source?.supportsAcceptanceCriteria).length})</option>
                <option value="validation_failed">Validation Failed ({tasks.filter(t => t.validation?.status === 'failed').length})</option>
                <option value="automation_eligible">Automation Eligible ({tasks.filter(t => t.automation === 'eligible').length})</option>
              </optgroup>
            </select>
          </div>
          <div className="beads-browser-sort">
            <label>Sort:</label>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="priority">Priority</option>
              <option value="status">Status</option>
              <option value="created">Created</option>
            </select>
          </div>
          <div className="beads-browser-actions">
            <button className="beads-refresh-btn" onClick={onRefresh} title="Refresh">&#8635;</button>
            <button className="beads-btn-create" onClick={onCreateNew}>+ New Task</button>
          </div>
        </div>

        <div className="beads-browser-content">
          {filteredTasks.length === 0 ? (
            <div className="beads-browser-empty">
              {filter === 'all' ? 'No tasks yet' : `No ${filter.replace('_', ' ')} tasks`}
            </div>
          ) : (
            <div className="beads-browser-list">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className={`beads-browser-item ${getPriorityClass(task.priority)} status-${task.status}`}
                >
                  <div className="beads-browser-item-header">
                    <div className="beads-browser-item-status">
                      {task.status === 'closed' ? (
                        <span className="beads-task-done">&#10003;</span>
                      ) : task.status === 'in_progress' ? (
                        <button
                          className="beads-task-check"
                          onClick={() => onComplete(task.id)}
                          title="Mark complete"
                        >
                          &#9675;
                        </button>
                      ) : (
                        <button
                          className="beads-task-start"
                          onClick={(e) => onStart(e, task.id)}
                          title="Start task"
                        >
                          &#9654;
                        </button>
                      )}
                    </div>
                    <div className="beads-browser-item-title-row">
                      <span
                        className={`beads-browser-item-title ${task.status === 'closed' ? 'completed' : ''}`}
                        onClick={() => onOpenDetail(task)}
                      >
                        {task.title}
                      </span>
                      <span className="beads-browser-item-id" title={task.id}>{task.displayId ?? task.id}</span>
                    </div>
                    <div className="beads-browser-item-actions">
                      <button
                        className={`beads-browser-status-btn status-${task.status}`}
                        onClick={() => onCycleStatus(task.id, task.status)}
                        title="Click to cycle status"
                      >
                        {formatStatusLabel(task.status)}
                      </button>
                      <button
                        className="beads-task-delete"
                        onClick={() => onDelete(task.id)}
                        title="Delete task"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="beads-browser-item-meta">
                    <select
                      className={`beads-browser-priority-select ${getPriorityClass(task.priority)}`}
                      value={task.priority ?? 2}
                      onChange={(e) => onChangePriority(task.id, Number(e.target.value))}
                      onClick={(e) => e.stopPropagation()}
                      title="Change priority"
                    >
                      {PRIORITY_LABELS.map((label, i) => (
                        <option key={i} value={i}>P{i} {label}</option>
                      ))}
                    </select>
                    
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

                    {task.created_at && (
                      <span className="beads-browser-date">
                        {new Date(task.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {task.description && (
                    <div className="beads-browser-item-desc">{task.description}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="beads-browser-footer">
          <span className="beads-browser-stats">
            {tasks.filter(t => t.status === 'open').length} open,
            {' '}{tasks.filter(t => t.status === 'in_progress').length} in progress,
            {' '}{tasks.filter(t => t.status === 'closed').length} closed
          </span>
          {tasks.some(t => t.status === 'closed') && (
            <button
              className="beads-clear-btn"
              onClick={onClearCompleted}
              title="Clear completed tasks"
            >
              Clear Completed
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
