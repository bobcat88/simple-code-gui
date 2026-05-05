import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentBoard } from './AgentBoard'
import * as useAgentBoardModule from '../hooks/useAgentBoard'

vi.mock('./agents/QueuePanel', () => ({
  QueuePanel: ({ agentName, onClose }: { agentName: string; onClose: () => void }) => (
    <aside aria-label="queue-panel">
      <span>{agentName}'s Queue</span>
      <button type="button" onClick={onClose}>Close Queue</button>
    </aside>
  ),
}))

vi.mock('./agents/TracePanel', () => ({
  TracePanel: ({ agentId, onClose }: { agentId: string; onClose: () => void }) => (
    <aside aria-label="trace-panel">
      <span>Trace for {agentId}</span>
      <button type="button" onClick={onClose}>Close Trace</button>
    </aside>
  ),
}))

const cancelTask = vi.fn(() => Promise.resolve())
const refresh = vi.fn(() => Promise.resolve())
const triggerEvolution = vi.fn(() => Promise.resolve())

const baseHook = {
  loading: false,
  providerHealth: { claude: 'healthy', gemini: '' },
  cancelTask,
  updateStatus: vi.fn(() => Promise.resolve()),
  listTasks: vi.fn(() => Promise.resolve([])),
  updateTaskPriority: vi.fn(() => Promise.resolve()),
  listTraces: vi.fn(() => Promise.resolve([])),
  addTrace: vi.fn(() => Promise.resolve()),
  refresh,
  refreshBurnRates: vi.fn(() => Promise.resolve()),
  agents: [
    {
      id: 'agent-1',
      name: 'Alpha',
      role: 'builder',
      status: 'working',
      model: 'sonnet',
      provider: 'claude',
      burn_rate: 0.1234,
      quality_score: 0.92,
      queue_size: 3,
      active_task: 'Refactor coverage suite',
    },
    {
      id: 'agent-2',
      name: 'Beta',
      role: 'reviewer',
      status: 'waiting',
      model: 'flash',
      provider: 'gemini',
      burn_rate: 0.004,
      quality_score: 0.58,
      queue_size: 0,
    },
  ],
} as unknown as ReturnType<typeof useAgentBoardModule.useAgentBoard>

beforeEach(() => {
  vi.spyOn(useAgentBoardModule, 'useAgentBoard').mockReturnValue(baseHook)
  cancelTask.mockClear()
  refresh.mockClear()
  triggerEvolution.mockClear()
  ;(window as unknown as { tauriIpc: { ai_trigger_evolution: typeof triggerEvolution } }).tauriIpc = {
    ai_trigger_evolution: triggerEvolution,
  }
})

describe('AgentBoard', () => {
  it('shows agent HUD cards with health, queue, quality, burn rate, and active task state', () => {
    render(<AgentBoard />)

    expect(screen.getByText('Agent Coordination')).toBeInTheDocument()
    expect(screen.getByText('2 Active')).toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Q:92')).toBeInTheDocument()
    expect(screen.getByText('$0.1234/h')).toBeInTheDocument()
    expect(screen.getByText('Refactor coverage suite')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('pops queue and trace panels in and out when agent controls are used', () => {
    render(<AgentBoard />)

    fireEvent.click(screen.getByText('Alpha'))
    expect(screen.getByLabelText('queue-panel')).toHaveTextContent("Alpha's Queue")

    const traceButtons = screen.getAllByRole('button').filter(button =>
      button.querySelector('.lucide-activity')
    )
    fireEvent.click(traceButtons[0])
    expect(screen.getByLabelText('trace-panel')).toHaveTextContent('Trace for agent-1')

    fireEvent.click(screen.getByText('Close Trace'))
    expect(screen.queryByLabelText('trace-panel')).not.toBeInTheDocument()
  })

  it('cancels active work without toggling the selected agent card', async () => {
    render(<AgentBoard />)

    const cancelButton = screen.getByTitle('Cancel Task')
    fireEvent.click(cancelButton)

    await waitFor(() => expect(cancelTask).toHaveBeenCalledWith('agent-1'))
    expect(screen.queryByLabelText('queue-panel')).not.toBeInTheDocument()
  })

  it('runs self-healing evolution then refreshes agent state', async () => {
    render(<AgentBoard />)

    fireEvent.click(screen.getByText('Trigger Evolution'))

    await waitFor(() => expect(triggerEvolution).toHaveBeenCalledOnce())
    await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
  })

  it('renders loading pulse while agent state is hydrating', () => {
    vi.spyOn(useAgentBoardModule, 'useAgentBoard').mockReturnValue({ ...baseHook, loading: true })

    render(<AgentBoard />)

    expect(screen.getByText('Loading agents...')).toHaveClass('animate-pulse')
  })
})
