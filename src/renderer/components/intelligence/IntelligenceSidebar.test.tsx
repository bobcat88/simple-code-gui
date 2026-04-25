import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { IntelligenceSidebar } from './IntelligenceSidebar'
import type { ExtendedApi, ProjectCapabilityScan, ProjectIntelligence } from '../../api/types'

const baseIntelligence: ProjectIntelligence = {
  git: {
    branch: 'main',
    isDirty: false,
    uncommittedCount: 0,
    recentCommits: [],
    ahead: 0,
    behind: 0
  },
  stacks: [],
  health: {
    score: 42,
    hasGit: true,
    hasReadme: false,
    hasCi: false,
    hasTests: true,
    hasLinter: false,
    hasLockfile: true
  }
}

const baseCapabilityScan: ProjectCapabilityScan = {
  rootPath: '/workspace/project',
  scannedAt: '2026-04-21T13:45:30.000Z',
  initializationState: 'MissingContracts',
  markers: [],
  capabilities: [],
  warnings: [],
  blockers: [],
  upgradeInputs: {
    canProposeMinimal: true,
    canProposeStandard: true,
    canProposeFull: true,
    recommendedPreset: 'Standard',
    createCandidates: [],
    modifyCandidates: [],
    preserveCandidates: [],
    migrationSources: [],
    rollbackNotes: []
  },
  totalFileCount: 1234,
  scanDurationMs: 456,
  projectHealthScore: 87.6
}

function renderSidebar(capabilityScan: ProjectCapabilityScan | null) {
  return render(
    <IntelligenceSidebar
      intelligence={baseIntelligence}
      capabilityScan={capabilityScan}
      api={{} as ExtendedApi}
      loading={false}
      onClose={vi.fn()}
      onRefresh={vi.fn()}
      onDeepScan={vi.fn()}
      onReindex={vi.fn()}
      onSyncMemory={vi.fn()}
      onOpenSearch={vi.fn()}
      onWidthChange={vi.fn()}
      vectorStatus={null}
      width={320}
    />
  )
}

describe('IntelligenceSidebar scan metrics', () => {
  it('renders scan metrics from ProjectCapabilityScan camelCase fields', () => {
    const scanWithSnakeCaseDecoys = {
      ...baseCapabilityScan,
      scanned_at: '2000-01-01T00:00:00.000Z',
      total_file_count: 7,
      scan_duration_ms: 999,
      project_health_score: 12
    } as ProjectCapabilityScan

    renderSidebar(scanWithSnakeCaseDecoys)

    expect(screen.getByText('Missing Contracts')).toBeInTheDocument()
    expect(screen.getByText('88%')).toBeInTheDocument()
    expect(screen.getByText('1234 files | 456ms')).toBeInTheDocument()
    expect(screen.getByText(`Last scan: ${new Date(baseCapabilityScan.scannedAt).toLocaleTimeString()}`)).toBeInTheDocument()
  })

  it('renders a ready state without scan metrics when capabilityScan is null', () => {
    renderSidebar(null)

    expect(screen.getByText('Ready')).toBeInTheDocument()
    expect(screen.queryByText('1234 files | 456ms')).not.toBeInTheDocument()
    expect(screen.queryByText('Missing Contracts')).not.toBeInTheDocument()
    expect(screen.queryByText('88%')).not.toBeInTheDocument()
  })
})
