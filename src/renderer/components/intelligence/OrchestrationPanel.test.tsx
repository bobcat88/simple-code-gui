import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OrchestrationPanel } from './OrchestrationPanel';
import * as useSwarmAgentsModule from '../../hooks/useSwarmAgents';
import type { BackendId } from '../../api/types';

const mockSetPending = vi.fn();
const mockApplyChanges = vi.fn(() => Promise.resolve());

const baseHook = {
  agents: [
    { id: 'a1', name: 'Alpha', role: 'worker', status: 'active', model: 'opus', provider: 'claude' as BackendId, burn_rate: 0, quality_score: 1, queue_size: 0 },
  ],
  pending: {},
  setPending: mockSetPending,
  hasChanges: false,
  applyChanges: mockApplyChanges,
  applying: false,
  applyError: null,
};

beforeEach(() => {
  vi.spyOn(useSwarmAgentsModule, 'useSwarmAgents').mockReturnValue(baseHook);
  mockSetPending.mockClear();
  mockApplyChanges.mockClear();
});

afterEach(() => vi.restoreAllMocks());

describe('OrchestrationPanel', () => {
  it('renders FAB button', () => {
    render(<OrchestrationPanel />);
    expect(screen.getByRole('button', { name: /orchestration/i })).toBeInTheDocument();
  });

  it('panel is hidden by default', () => {
    render(<OrchestrationPanel />);
    expect(screen.queryByText('Apply to Swarm')).not.toBeInTheDocument();
  });

  it('panel opens when FAB is clicked', () => {
    render(<OrchestrationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /orchestration/i }));
    expect(screen.getByText('Apply to Swarm')).toBeInTheDocument();
  });

  it('renders agent rows when open', () => {
    render(<OrchestrationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /orchestration/i }));
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('shows claude model chips (opus/sonnet/haiku) when claude provider is active', () => {
    render(<OrchestrationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /orchestration/i }));
    expect(screen.getByText('Opus')).toBeInTheDocument();
    expect(screen.getByText('Sonnet')).toBeInTheDocument();
    expect(screen.getByText('Haiku')).toBeInTheDocument();
  });

  it('clicking a provider chip calls setPending', () => {
    render(<OrchestrationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /orchestration/i }));
    fireEvent.click(screen.getByText('Gemini'));
    expect(mockSetPending).toHaveBeenCalledWith('a1', { provider: 'gemini', model: 'default' });
  });

  it('Apply button is disabled when hasChanges is false', () => {
    render(<OrchestrationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /orchestration/i }));
    const btn = screen.getByText('Apply to Swarm').closest('button');
    expect(btn).toBeDisabled();
  });

  it('Apply button is enabled when hasChanges is true', () => {
    vi.spyOn(useSwarmAgentsModule, 'useSwarmAgents').mockReturnValue({ ...baseHook, hasChanges: true });
    render(<OrchestrationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /orchestration/i }));
    const btn = screen.getByText('Apply to Swarm').closest('button');
    expect(btn).not.toBeDisabled();
  });

  it('Apply button calls applyChanges', async () => {
    vi.spyOn(useSwarmAgentsModule, 'useSwarmAgents').mockReturnValue({ ...baseHook, hasChanges: true });
    render(<OrchestrationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /orchestration/i }));
    fireEvent.click(screen.getByText('Apply to Swarm').closest('button')!);
    await waitFor(() => expect(mockApplyChanges).toHaveBeenCalledOnce());
  });

  it('shows empty state when no agents', () => {
    vi.spyOn(useSwarmAgentsModule, 'useSwarmAgents').mockReturnValue({ ...baseHook, agents: [] });
    render(<OrchestrationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /orchestration/i }));
    expect(screen.getByText(/no active agents/i)).toBeInTheDocument();
  });

  it('shows error message when applyError is set', () => {
    vi.spyOn(useSwarmAgentsModule, 'useSwarmAgents').mockReturnValue({ ...baseHook, applyError: 'Backend unavailable' });
    render(<OrchestrationPanel />);
    fireEvent.click(screen.getByRole('button', { name: /orchestration/i }));
    expect(screen.getByText('Backend unavailable')).toBeInTheDocument();
  });
});
