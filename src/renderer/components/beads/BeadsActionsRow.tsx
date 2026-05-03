import React from 'react'

interface BeadsActionsRowProps {
  hasClosedTasks: boolean
  onAddTask: () => void
  onClearCompleted: () => void
  onRefresh: () => void
}

export function BeadsActionsRow({
  hasClosedTasks,
  onAddTask,
  onClearCompleted,
  onRefresh
}: BeadsActionsRowProps): React.ReactElement {
  return (
    <div className="beads-actions-row">
      <button className="beads-add-btn" onClick={onAddTask}>
        + Add Task
      </button>
      {hasClosedTasks && (
        <button
          className="beads-clear-btn"
          onClick={onClearCompleted}
          aria-label="Mark complete"
          title="Mark complete"
        >
          &#10003;
        </button>
      )}
      <button
        className="beads-refresh-btn"
        onClick={onRefresh}
        aria-label="Refresh"
        title="Refresh"
      >
        &#8635;
      </button>
    </div>
  )
}
