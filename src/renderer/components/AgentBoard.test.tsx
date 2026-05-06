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

  it('renders all role icons without crashing for all role types', () => {
    vi.spyOn(useAgentBoardModule, 'useAgentBoard').mockReturnValue({
      ...baseHook,
      agents: [
        { ...baseHook.agents[0], id: 'a1', name: 'Planner', role: 'planner', status: 'idle', provider: 'claude' },
        { ...baseHook.agents[0], id: 'a2', name: 'Builder', role: 'builder', status: 'idle', provider: 'claude' },
        { ...baseHook.agents[0], id: 'a3', name: 'Reviewer', role: 'reviewer', status: 'idle', provider: 'claude' },
        { ...baseHook.agents[0], id: 'a4', name: 'GitBot', role: 'git', status: 'idle', provider: 'claude' },
        { ...baseHook.agents[0], id: 'a5', name: 'Researcher', role: 'researcher', status: 'idle', provider: 'claude' },
        { ...baseHook.agents[0], id: 'a6', name: 'Unknown', role: 'unknown', status: 'idle', provider: 'claude' },
      ],
    })
    render(<AgentBoard />)
    expect(screen.getByText('Planner')).toBeInTheDocument()
    expect(screen.getByText('GitBot')).toBeInTheDocument()
    expect(screen.getByText('Researcher')).toBeInTheDocument()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(screen.getByText('6 Active')).toBeInTheDocument()
  })

  it('shows correct status colors for all agent statuses', () => {
    vi.spyOn(useAgentBoardModule, 'useAgentBoard').mockReturnValue({
      ...baseHook,
      agents: [
        { ...baseHook.agents[0], id: 'a1', name: 'Idle', role: 'builder', status: 'idle', queue_size: 0, active_task: undefined },
        { ...baseHook.agents[0], id: 'a2', name: 'Working', role: 'builder', status: 'working', queue_size: 0, active_task: undefined },
        { ...baseHook.agents[0], id: 'a3', name: 'Waiting', role: 'builder', status: 'waiting', queue_size: 0, active_task: undefined },
        { ...baseHook.agents[0], id: 'a4', name: 'Errored', role: 'builder', status: 'error', queue_size: 0, active_task: undefined },
      ],
    })
    render(<AgentBoard />)
    expect(screen.getByText('idle')).toBeInTheDocument()
    expect(screen.getByText('working')).toBeInTheDocument()
    expect(screen.getByText('waiting')).toBeInTheDocument()
    expect(screen.getByText('error')).toBeInTheDocument()
  })

  it('renders provider health colors: undefined and unhealthy providers', () => {
    vi.spyOn(useAgentBoardModule, 'useAgentBoard').mockReturnValue({
      ...baseHook,
      providerHealth: { claude: 'unhealthy' },
      agents: [
        { ...baseHook.agents[0], id: 'a1', name: 'NoProvider', role: 'builder', status: 'idle', provider: 'none', queue_size: 0 },
        { ...baseHook.agents[0], id: 'a2', name: 'Unhealthy', role: 'builder', status: 'idle', provider: 'claude', queue_size: 0 },
        { ...baseHook.agents[0], id: 'a3', name: 'Unknown', role: 'builder', status: 'idle', provider: 'openai', queue_size: 0 },
      ],
    })
    render(<AgentBoard />)
    expect(screen.getByText('NoProvider')).toBeInTheDocument()
    expect(screen.getByText('Unhealthy')).toBeInTheDocument()
  })

  it('opens queue panel on queue button click and trace panel on trace button click', () => {
    render(<AgentBoard />)

    // Click queue icon button on agent card
    const queueButtons = screen.getAllByRole('button').filter(b => b.querySelector('.lucide-list-todo'))
    fireEvent.click(queueButtons[0])
    expect(screen.getByLabelText('queue-panel')).toBeInTheDocument()

    // Now switch to trace for same agent
    const traceButtons = screen.getAllByRole('button').filter(b => b.querySelector('.lucide-activity'))
    fireEvent.click(traceButtons[0])
    expect(screen.getByLabelText('trace-panel')).toBeInTheDocument()

    // Close via close button
    fireEvent.click(screen.getByText('Close Trace'))
    expect(screen.queryByLabelText('trace-panel')).not.toBeInTheDocument()
  })

  it('deselects agent when clicking on the selected card again', () => {
    render(<AgentBoard />)

    fireEvent.click(screen.getByText('Alpha'))
    expect(screen.getByLabelText('queue-panel')).toBeInTheDocument()

    // Click Alpha again to deselect
    fireEvent.click(screen.getByText('Alpha'))
    expect(screen.queryByLabelText('queue-panel')).not.toBeInTheDocument()
  })

  it('shows empty board when no agents are active', () => {
    vi.spyOn(useAgentBoardModule, 'useAgentBoard').mockReturnValue({ ...baseHook, agents: [] })
    render(<AgentBoard />)
    expect(screen.getByText('0 Active')).toBeInTheDocument()
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
  })
})
