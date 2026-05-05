import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OrchestrationPanel } from './OrchestrationPanel'
import type { AgentAction, AgentStatus, SystemTelemetry } from './types'

type ActionCallback = (action: AgentAction) => void
type StatusCallback = (status: AgentStatus) => void
type TelemetryCallback = (telemetry: SystemTelemetry) => void

const unsubAction = vi.fn()
const unsubStatus = vi.fn()
const unsubTelemetry = vi.fn()
const approveAction = vi.fn(() => Promise.resolve())
const rejectAction = vi.fn(() => Promise.resolve())

let actionCallback: ActionCallback
let statusCallback: StatusCallback
let telemetryCallback: TelemetryCallback

const makeAction = (overrides: Partial<AgentAction> = {}): AgentAction => ({
  id: 'act-1',
  agentId: 'agent-1',
  agentName: 'Planner',
  type: 'thought',
  message: 'Analyzing dependency graph',
  timestamp: 1710000000000,
  metadata: { file: 'src/main.ts' },
  ...overrides,
})

const makeStatus = (overrides: Partial<AgentStatus> = {}): AgentStatus => ({
  id: 'agent-1',
  name: 'Builder',
  role: 'Builder',
  status: 'busy',
  currentTask: 'Repair failing tests',
  progress: 42,
  metrics: {
    tasksCompleted: 7,
    uptime: 540,
    memoryUsage: 128,
  },
  ...overrides,
})

beforeEach(() => {
  unsubAction.mockClear()
  unsubStatus.mockClear()
  unsubTelemetry.mockClear()
  approveAction.mockClear()
  rejectAction.mockClear()

  window.api = {
    onAgentAction: vi.fn((callback: ActionCallback) => {
      actionCallback = callback
      return unsubAction
    }),
    onAgentStatus: vi.fn((callback: StatusCallback) => {
      statusCallback = callback
      return unsubStatus
    }),
    onTelemetry: vi.fn((callback: TelemetryCallback) => {
      telemetryCallback = callback
      return unsubTelemetry
    }),
    approveAction,
    rejectAction,
  }
})

afterEach(() => {
  delete window.api
})

describe('OrchestrationPanel runtime HUD', () => {
  it('streams telemetry and agent status into functional HUD elements', () => {
    render(<OrchestrationPanel />)

    act(() => {
      telemetryCallback({ cpu: 34, memory: 2048, activeJobs: 3, uptime: 3661, health: 'degraded' })
      statusCallback(makeStatus())
    })

    expect(screen.getByText('System degraded')).toBeInTheDocument()
    expect(screen.getByText('34%')).toBeInTheDocument()
    expect(screen.getByText('2048MB')).toBeInTheDocument()
    expect(screen.getByText('1h 1m')).toBeInTheDocument()
    expect(screen.getAllByText('Builder').length).toBeGreaterThan(0)
    expect(screen.getByText('Repair failing tests')).toBeInTheDocument()
    expect(screen.getByText('42%')).toBeInTheDocument()
  })

  it('adds activity feed items, file metadata, and approval popups from agent actions', () => {
    render(<OrchestrationPanel />)

    act(() => {
      actionCallback(makeAction())
      actionCallback(makeAction({
        id: 'approval-1',
        type: 'approval_request',
        message: 'Run self-healing agent?',
      }))
    })

    expect(screen.getByText('Analyzing dependency graph')).toBeInTheDocument()
    expect(screen.getAllByText('src/main.ts')).toHaveLength(2)
    expect(screen.getByText('Pending Approvals')).toBeInTheDocument()
    expect(screen.getAllByText('Run self-healing agent?')).toHaveLength(2)
  })

  it('approves and rejects popup approvals through the API and removes them from screen', async () => {
    render(<OrchestrationPanel />)

    act(() => {
      actionCallback(makeAction({ id: 'approval-1', type: 'approval_request', message: 'Approve optimization?' }))
      actionCallback(makeAction({ id: 'approval-2', type: 'approval_request', message: 'Reject risky command?' }))
    })

    fireEvent.click(screen.getAllByText('Approve')[0])
    await waitFor(() => expect(approveAction).toHaveBeenCalledWith('approval-1'))
    expect(within(screen.getByText('Pending Approvals').parentElement!).queryByText('Approve optimization?')).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByText('Reject')[0])
    await waitFor(() => expect(rejectAction).toHaveBeenCalledWith('approval-2'))
    expect(screen.queryByText('Pending Approvals')).not.toBeInTheDocument()
  })

  it('unsubscribes from live streams on unmount', () => {
    const { unmount } = render(<OrchestrationPanel />)

    unmount()

    expect(unsubAction).toHaveBeenCalledOnce()
    expect(unsubStatus).toHaveBeenCalledOnce()
    expect(unsubTelemetry).toHaveBeenCalledOnce()
  })
})
