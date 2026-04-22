import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApprovalWorkflow } from './ApprovalWorkflow'
import type { ApprovalRequest } from '../../api/types'

const requests: ApprovalRequest[] = [
  {
    id: 'approval-1',
    agentId: 'codex-agent',
    agentName: 'Codex',
    category: 'file_change',
    risk: 'high',
    title: 'Refine approval UI',
    description: 'Split the workflow into a review list, detail pane, and explicit action controls.',
    fileDiffs: [
      {
        path: 'src/renderer/components/orchestration/ApprovalWorkflow.tsx',
        hunks: [
          {
            oldStart: 1,
            newStart: 1,
            lines: ['- old implementation', '+ new implementation', '  shared detail'],
          },
        ],
      },
    ],
    affectedPaths: ['src/renderer/components/orchestration/ApprovalWorkflow.tsx'],
    reversible: true,
    timestamp: Date.parse('2026-04-22T10:00:00Z'),
  },
  {
    id: 'approval-2',
    agentId: 'claude-agent',
    agentName: 'Claude',
    category: 'command',
    risk: 'medium',
    title: 'Run validation command',
    description: 'Execute the verification command after the UI lands.',
    command: 'bun run build',
    affectedPaths: ['src/renderer/components/orchestration/ApprovalWorkflow.test.tsx'],
    reversible: false,
    timestamp: Date.parse('2026-04-22T11:00:00Z'),
    expiresAt: Date.parse('2026-04-22T12:00:00Z'),
  },
]

describe('ApprovalWorkflow', () => {
  it('renders the queue and selected request details', () => {
    render(<ApprovalWorkflow requests={requests} />)

    expect(screen.getByText('Review queue')).toBeInTheDocument()
    expect(screen.getAllByText('Refine approval UI').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Run validation command').length).toBeGreaterThan(0)
    expect(screen.getByText('Proposed change')).toBeInTheDocument()
    expect(screen.getByText('src/renderer/components/orchestration/ApprovalWorkflow.tsx')).toBeInTheDocument()
    expect(screen.getByText('- old implementation')).toBeInTheDocument()
    expect(screen.getByText('+ new implementation')).toBeInTheDocument()
  })

  it('switches the active request and approves or rejects with the current note', () => {
    const onApprove = vi.fn()
    const onReject = vi.fn()

    render(
      <ApprovalWorkflow
        requests={requests}
        onApprove={onApprove}
        onReject={onReject}
      />
    )

    fireEvent.change(screen.getByLabelText('Review note'), { target: { value: 'Looks good to ship.' } })
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))

    expect(onApprove).toHaveBeenCalledWith(requests[0], 'Looks good to ship.')
    expect(screen.getByText('1 approved')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /run validation command/i }))
    fireEvent.change(screen.getByLabelText('Review note'), { target: { value: 'Please hold for one more pass.' } })
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))

    expect(onReject).toHaveBeenCalledWith(requests[1], 'Please hold for one more pass.')
    expect(screen.getByText('1 rejected')).toBeInTheDocument()
    expect(screen.getByText('bun run build')).toBeInTheDocument()
  })

  it('submits request-change notes and parsed conditions', () => {
    const onRequestChanges = vi.fn()

    render(
      <ApprovalWorkflow
        requests={requests}
        onRequestChanges={onRequestChanges}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /run validation command/i }))
    fireEvent.change(screen.getByLabelText('Review note'), { target: { value: 'Break this into a smaller step.' } })
    fireEvent.change(screen.getByLabelText(/request changes conditions/i), {
      target: { value: 'Add rollback coverage, add a focused test' },
    })
    fireEvent.click(screen.getByRole('button', { name: /request changes/i }))

    expect(onRequestChanges).toHaveBeenCalledWith(
      requests[1],
      'Break this into a smaller step.',
      ['Add rollback coverage', 'add a focused test']
    )
    expect(screen.getByText('1 changed')).toBeInTheDocument()
  })

  it('shows an empty state when there are no approvals', () => {
    render(<ApprovalWorkflow requests={[]} />)

    expect(screen.getByText('No approvals waiting')).toBeInTheDocument()
    expect(screen.getByText('Proposed agent changes will appear here for review before they are applied.')).toBeInTheDocument()
  })
})
