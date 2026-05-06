import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentTask, AgentTrace } from '../../hooks/useAgentBoard';
import { QueuePanel } from './QueuePanel';
import { TracePanel } from './TracePanel';

vi.mock('../../hooks/useAgentBoard', () => ({
  useAgentBoard: vi.fn(),
}));

import { useAgentBoard } from '../../hooks/useAgentBoard';

const makeTask = (overrides: Partial<AgentTask> = {}): AgentTask => ({
  id: 'task-1',
  agentId: 'agent-1',
  title: 'Fix the flakiness',
  priority: 5,
  status: 'queued',
  createdAt: new Date('2026-05-06T10:00:00Z').toISOString(),
  updatedAt: new Date('2026-05-06T10:01:00Z').toISOString(),
  ...overrides,
});

const makeTrace = (overrides: Partial<AgentTrace> = {}): AgentTrace => ({
  id: 'trace-1',
  agentId: 'agent-1',
  step_name: 'ANALYZE',
  details: 'Reading source files',
  status: 'success',
  duration_ms: 42,
  timestamp: new Date('2026-05-06T10:00:00Z').toISOString(),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('QueuePanel', () => {
  it('renders agent name and shows tasks', async () => {
    const listTasks = vi.fn(() => Promise.resolve([makeTask()]));
    const updateTaskPriority = vi.fn(() => Promise.resolve());
    vi.mocked(useAgentBoard).mockReturnValue({ listTasks, updateTaskPriority } as any);

    const onClose = vi.fn();
    render(<QueuePanel agentId="agent-1" agentName="Nexus" onClose={onClose} />);

    expect(screen.getByText("Nexus's Queue")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Fix the flakiness')).toBeInTheDocument());
    expect(screen.getByText(/Priority: 5/)).toBeInTheDocument();
  });

  it('shows empty state when no tasks', async () => {
    vi.mocked(useAgentBoard).mockReturnValue({
      listTasks: vi.fn(() => Promise.resolve([])),
      updateTaskPriority: vi.fn(),
    } as any);

    render(<QueuePanel agentId="agent-1" agentName="A" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText('No tasks in queue')).toBeInTheDocument());
  });

  it('calls updateTaskPriority on arrow click', async () => {
    const updateTaskPriority = vi.fn(() => Promise.resolve());
    const listTasks = vi.fn(() => Promise.resolve([makeTask()]));
    vi.mocked(useAgentBoard).mockReturnValue({ listTasks, updateTaskPriority } as any);

    render(<QueuePanel agentId="agent-1" agentName="A" onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Fix the flakiness'));

    fireEvent.click(screen.getAllByRole('button')[1]); // ArrowUp
    await waitFor(() => expect(updateTaskPriority).toHaveBeenCalledWith('task-1', 6));
  });

  it('calls onClose when close button clicked', async () => {
    vi.mocked(useAgentBoard).mockReturnValue({
      listTasks: vi.fn(() => Promise.resolve([])),
      updateTaskPriority: vi.fn(),
    } as any);

    const onClose = vi.fn();
    render(<QueuePanel agentId="agent-1" agentName="A" onClose={onClose} />);
    await waitFor(() => screen.getByText("A's Queue"));
    fireEvent.click(screen.getByRole('button', { name: '' })); // Trash2 button
    expect(onClose).toHaveBeenCalled();
  });

  it('renders working status icon', async () => {
    vi.mocked(useAgentBoard).mockReturnValue({
      listTasks: vi.fn(() => Promise.resolve([makeTask({ status: 'working' })])),
      updateTaskPriority: vi.fn(),
    } as any);

    render(<QueuePanel agentId="agent-1" agentName="A" onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('Fix the flakiness'));
    // working status applies blue border class
    const taskCard = screen.getByText('Fix the flakiness').closest('div[class*="bg-blue"]');
    expect(taskCard).not.toBeNull();
  });
});

describe('TracePanel', () => {
  it('renders trace steps with details and duration', async () => {
    vi.mocked(useAgentBoard).mockReturnValue({
      listTraces: vi.fn(() => Promise.resolve([makeTrace()])),
    } as any);

    render(<TracePanel agentId="agent-1" onClose={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('ANALYZE')).toBeInTheDocument());
    expect(screen.getByText('Reading source files')).toBeInTheDocument();
    expect(screen.getByText('42ms')).toBeInTheDocument();
  });

  it('shows empty state when no traces', async () => {
    vi.mocked(useAgentBoard).mockReturnValue({
      listTraces: vi.fn(() => Promise.resolve([])),
    } as any);

    render(<TracePanel agentId="agent-1" onClose={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText('No execution data available')).toBeInTheDocument()
    );
  });

  it('calls onClose on chevron click', async () => {
    vi.mocked(useAgentBoard).mockReturnValue({
      listTraces: vi.fn(() => Promise.resolve([])),
    } as any);

    const onClose = vi.fn();
    render(<TracePanel agentId="agent-1" onClose={onClose} />);
    await waitFor(() => screen.getByText('Live Workflow Trace'));
    fireEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders different status icons for running/failed traces', async () => {
    vi.mocked(useAgentBoard).mockReturnValue({
      listTraces: vi.fn(() =>
        Promise.resolve([
          makeTrace({ id: 't1', step_name: 'RUN', status: 'running' }),
          makeTrace({ id: 't2', step_name: 'FAIL', status: 'failed' }),
        ])
      ),
    } as any);

    render(<TracePanel agentId="agent-1" onClose={vi.fn()} />);
    await waitFor(() => screen.getByText('RUN'));
    expect(screen.getByText('FAIL')).toBeInTheDocument();
  });
});
