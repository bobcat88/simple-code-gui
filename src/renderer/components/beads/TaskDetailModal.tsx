import React from 'react'
import ReactDOM from 'react-dom'
import type { UnifiedTask } from './adapters/types.js'
import { getPriorityClass, formatStatusLabel } from './types.js'

interface TaskDetailModalProps {
  show: boolean
  task: UnifiedTask | null
  loading: boolean
  editing: boolean
  setEditing: (editing: boolean) => void
  editTitle: string
  setEditTitle: (title: string) => void
  editDescription: string
  setEditDescription: (description: string) => void
  editPriority: number
  setEditPriority: (priority: number) => void
  editStatus: string
  setEditStatus: (status: string) => void
  onClose: () => void
  onSave: () => void
}

export function TaskDetailModal({
  show, task, loading, editing, setEditing,
  editTitle, setEditTitle,
  editDescription, setEditDescription,
  editPriority, setEditPriority,
  editStatus, setEditStatus,
  onClose, onSave
}: TaskDetailModalProps) {
  if (!show) return null

  return ReactDOM.createPortal(
    <div className="beads-modal-overlay" onClick={onClose}>
      <div className="beads-modal beads-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="beads-modal-header">
          <h3>{task?.id || 'Task Details'}</h3>
          <button className="beads-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="beads-modal-body">
          {loading ? (
            <div className="beads-detail-loading">Loading...</div>
          ) : task ? (
            editing ? (
              <>
                <div className="beads-form-group">
                  <label htmlFor="detail-title">Title</label>
                  <input
                    id="detail-title"
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="beads-form-row">
                  <div className="beads-form-group">
                    <label htmlFor="detail-status">Status</label>
                    <select id="detail-status" value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div className="beads-form-group">
                    <label htmlFor="detail-priority">Priority</label>
                    <select id="detail-priority" value={editPriority} onChange={(e) => setEditPriority(parseInt(e.target.value))}>
                      <option value="0">P0 - Critical</option>
                      <option value="1">P1 - High</option>
                      <option value="2">P2 - Medium</option>
                      <option value="3">P3 - Low</option>
                      <option value="4">P4 - Lowest</option>
                    </select>
                  </div>
                </div>
                <div className="beads-form-group">
                  <label htmlFor="detail-description">Description</label>
                  <textarea
                    id="detail-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={5}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="beads-detail-title">{task.title}</div>
                <div className="beads-detail-meta">
                  <span className={`beads-detail-status status-${task.status}`}>
                    {formatStatusLabel(task.status)}
                  </span>
                  <span className={`beads-detail-priority ${getPriorityClass(task.priority)}`}>
                    P{task.priority ?? 2}
                  </span>
                  <span className="beads-detail-type">{task.type || 'task'}</span>
                </div>
                {task.description && (
                  <div className="beads-detail-description">
                    <label>Description</label>
                    <p>{task.description}</p>
                  </div>
                )}

                {/* Spec Section */}
                {(task.specItems || (task.source?.supportsSpecItems && !task.specItems)) && (
                  <div className="beads-detail-section">
                    <label>Linked Spec</label>
                    {task.specItems?.map(spec => (
                      <div key={spec.id} className="beads-spec-item">
                        <span className="beads-spec-icon">📄</span>
                        <span className="beads-spec-title">{spec.title}</span>
                        {spec.status && <span className="beads-spec-status">{spec.status}</span>}
                      </div>
                    )) || <div className="beads-detail-empty">No linked spec</div>}
                  </div>
                )}

                {/* Acceptance Criteria */}
                {(task.acceptanceCriteria || (task.source?.supportsAcceptanceCriteria && !task.acceptanceCriteria)) && (
                  <div className="beads-detail-section">
                    <label>Acceptance Criteria</label>
                    {task.acceptanceCriteria?.map(ac => (
                      <div key={ac.id} className={`beads-ac-item status-${ac.status}`}>
                        <span className="beads-ac-bullet">{ac.status === 'satisfied' ? '✓' : '○'}</span>
                        <span className="beads-ac-text">{ac.text}</span>
                      </div>
                    )) || <div className="beads-detail-empty">No criteria defined</div>}
                  </div>
                )}

                {/* Traits */}
                {task.traits && task.traits.length > 0 && (
                  <div className="beads-detail-section">
                    <label>Traits</label>
                    <div className="beads-detail-traits">
                      {task.traits.map(trait => (
                        <span key={trait.id} className={`beads-trait-chip kind-${trait.kind || 'default'}`}>
                          {trait.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Derived Tasks */}
                {task.derivedTasks && task.derivedTasks.length > 0 && (
                  <div className="beads-detail-section">
                    <label>Derived Tasks</label>
                    {task.derivedTasks.map(dt => (
                      <div key={dt.id} className="beads-derived-task">
                        <span className="beads-dt-status">●</span>
                        <span className="beads-dt-title">{dt.title}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Automation & Validation */}
                <div className="beads-detail-row">
                  {task.automation && (
                    <div className="beads-detail-section">
                      <label>Automation</label>
                      <span className={`beads-status-badge auto-${task.automation}`}>
                        {task.automation.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                  {task.validation && (
                    <div className="beads-detail-section">
                      <label>Validation</label>
                      <span className={`beads-status-badge val-${task.validation.status}`}>
                        {task.validation.satisfiedCriteria}/{task.validation.totalCriteria} Passed
                      </span>
                    </div>
                  )}
                </div>

                <div className="beads-detail-timestamps">
                  {task.created_at && <span>Created: {new Date(task.created_at).toLocaleString()}</span>}
                  {task.updated_at && <span>Updated: {new Date(task.updated_at).toLocaleString()}</span>}
                  {task.source && (
                    <span className="beads-detail-source">
                      Source: {task.source.sourceSystem} ({task.source.externalId})
                    </span>
                  )}
                </div>
                {task.tags && task.tags.length > 0 && !task.traits && (
                  <div className="beads-detail-tags">
                    {task.tags.map(tag => (
                      <span key={tag} className="beads-detail-tag">{tag}</span>
                    ))}
                  </div>
                )}

              </>
            )
          ) : (
            <div className="beads-detail-error">Task not found</div>
          )}
        </div>
        <div className="beads-modal-footer">
          {editing ? (
            <>
              <button className="beads-btn-cancel" onClick={() => setEditing(false)}>Cancel</button>
              <button className="beads-btn-create" onClick={onSave} disabled={!editTitle.trim()}>Save</button>
            </>
          ) : (
            <>
              <button className="beads-btn-cancel" onClick={onClose}>Close</button>
              <button className="beads-btn-create" onClick={() => setEditing(true)}>Edit</button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
