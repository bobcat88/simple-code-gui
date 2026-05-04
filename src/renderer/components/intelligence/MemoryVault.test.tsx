import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryVault } from './SwarmCognitiveHub';
import type { ExtendedApi, SwarmSnapshot } from '../../api/types';

const makeSnapshot = (id: string, name: string): SwarmSnapshot => ({
  id,
  project_path: '/proj',
  name,
  commit_sha: 'abc1234',
  snapshot_path: '/snaps/' + id,
  timestamp: Date.now() - 3600000,
});

const makeApi = (overrides: Partial<ExtendedApi> = {}): ExtendedApi => ({
  gsdHydrateSwarm: vi.fn(() => Promise.resolve({ success: true, count: 5 })),
  gsdCreateSnapshotWorkspace: vi.fn(() => Promise.resolve({ success: true, path: '/ws/abc' })),
  ...overrides,
} as unknown as ExtendedApi);

const snapshots = [makeSnapshot('s1', 'snap-alpha'), makeSnapshot('s2', 'snap-beta')];

describe('MemoryVault', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('renders snapshot names', () => {
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={makeApi()} projectPath="/proj" />);
    expect(screen.getByText('snap-alpha')).toBeInTheDocument();
    expect(screen.getByText('snap-beta')).toBeInTheDocument();
  });

  it('action buttons hidden by default', () => {
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={makeApi()} projectPath="/proj" />);
    expect(screen.queryByText(/restore messages/i)).not.toBeInTheDocument();
  });

  it('clicking row expands action buttons', () => {
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={makeApi()} projectPath="/proj" />);
    fireEvent.click(screen.getByText('snap-alpha'));
    expect(screen.getByText(/restore messages/i)).toBeInTheDocument();
    expect(screen.getByText(/branch workspace/i)).toBeInTheDocument();
  });

  it('clicking same row again collapses it', () => {
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={makeApi()} projectPath="/proj" />);
    fireEvent.click(screen.getByText('snap-alpha'));
    fireEvent.click(screen.getByText('snap-alpha'));
    expect(screen.queryByText(/restore messages/i)).not.toBeInTheDocument();
  });

  it('clicking different row switches expansion', () => {
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={makeApi()} projectPath="/proj" />);
    fireEvent.click(screen.getByText('snap-alpha'));
    fireEvent.click(screen.getByText('snap-beta'));
    expect(screen.getAllByText(/restore messages/i)).toHaveLength(1);
  });

  it('Restore Messages calls gsdHydrateSwarm with projectPath', async () => {
    const api = makeApi();
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={api} projectPath="/proj" />);
    fireEvent.click(screen.getByText('snap-alpha'));
    fireEvent.click(screen.getByText(/restore messages/i));
    await waitFor(() => expect(api.gsdHydrateSwarm).toHaveBeenCalledWith('/proj'));
  });

  it('Branch Workspace calls gsdCreateSnapshotWorkspace with snapshotId', async () => {
    const api = makeApi();
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={api} projectPath="/proj" />);
    fireEvent.click(screen.getByText('snap-alpha'));
    fireEvent.click(screen.getByText(/branch workspace/i));
    await waitFor(() => expect(api.gsdCreateSnapshotWorkspace).toHaveBeenCalledWith('s1'));
  });

  it('shows success message after restore', async () => {
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={makeApi()} projectPath="/proj" />);
    fireEvent.click(screen.getByText('snap-alpha'));
    fireEvent.click(screen.getByText(/restore messages/i));
    await waitFor(() => expect(screen.getByText(/restored 5 messages/i)).toBeInTheDocument());
  });

  it('shows success message after branch', async () => {
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={makeApi()} projectPath="/proj" />);
    fireEvent.click(screen.getByText('snap-alpha'));
    fireEvent.click(screen.getByText(/branch workspace/i));
    await waitFor(() => expect(screen.getByText(/workspace isolated/i)).toBeInTheDocument());
  });

  it('shows error message when restore fails', async () => {
    const api = makeApi({
      gsdHydrateSwarm: vi.fn(() => Promise.reject(new Error('Network error'))),
    });
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={api} projectPath="/proj" />);
    fireEvent.click(screen.getByText('snap-alpha'));
    fireEvent.click(screen.getByText(/restore messages/i));
    await waitFor(() => expect(screen.getByText(/network error/i)).toBeInTheDocument());
  });

  it('restore button disabled while loading', async () => {
    let resolveHydrate: () => void;
    const api = makeApi({
      gsdHydrateSwarm: vi.fn(() => new Promise<{ success: boolean; count: number }>((resolve) => { resolveHydrate = () => resolve({ success: true, count: 0 }); })),
    });
    render(<MemoryVault snapshots={snapshots} onRefresh={vi.fn()} api={api} projectPath="/proj" />);
    fireEvent.click(screen.getByText('snap-alpha'));
    fireEvent.click(screen.getByText(/restore messages/i));
    const btn = screen.getByRole('button', { name: /restore/i });
    expect(btn).toBeDisabled();
    resolveHydrate!();
  });

  it('shows empty state when no snapshots', () => {
    render(<MemoryVault snapshots={[]} onRefresh={vi.fn()} api={makeApi()} projectPath="/proj" />);
    expect(screen.getByText(/no neural footprints/i)).toBeInTheDocument();
  });
});
