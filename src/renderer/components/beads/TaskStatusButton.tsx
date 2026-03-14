import React from 'react'

interface TaskStatusButtonProps {
  status: string
  taskId: string
  onComplete: (id: string) => void
  onStart: (e: React.MouseEvent, id: string) => void
}

export function TaskStatusButton({
  status,
  taskId,
  onComplete,
  onStart
}: TaskStatusButtonProps): React.ReactElement {
  switch (status) {
    case 'closed':
      return <span className="beads-task-done">&#10003;</span>
    case 'in_progress':
      return (
        <button
          className="beads-task-check in-progress"
          onClick={() => onComplete(taskId)}
          title="Mark complete"
        >
          ◉
        </button>
      )
    default:
      return (
        <button
          className="beads-task-start"
          onClick={(e) => onStart(e, taskId)}
          title="Start task"
        >
          &#9654;
        </button>
      )
  }
}
