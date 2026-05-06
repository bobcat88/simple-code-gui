import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HealthDashboard } from './HealthDashboard'
import type { HealthStatus } from '../hooks/useHealthStatus'
import { useHealthStatus } from '../hooks/useHealthStatus'

vi.mock('../hooks/useHealthStatus', () => ({
  useHealthStatus: vi.fn(),
}))

const mockedUseHealthStatus = useHealthStatus as unknown as ReturnType<typeof vi.fn>

describe('HealthDashboard', () => {
  it('renders core service status and installed extension inventory', () => {
    const status: HealthStatus = {
      cpu_usage: 41.2,
      memory_usage: 3 * 1024 * 1024 * 1024,
      total_memory: 8 * 1024 * 1024 * 1024,
      threads: 12,
      status: 'Warning',
      services: [
        { id: 'database', name: 'Database', status: 'Healthy', detail: 'Connection ready', diagnostics: [] },
        { id: 'extensions', name: 'Extension Store', status: 'Healthy', detail: '2 installed extensions, 2 enabled, 1 MCP, 1 plugin', diagnostics: [] },
        { id: 'mcp_config', name: 'MCP Config', status: 'Warning', detail: 'No mcp_config.json found for 1 installed MCP', diagnostics: [] },
      ],
      installed_extensions: [
        {
          id: 'filesystem',
          name: 'Filesystem MCP',
          description: 'Read and write file access',
          type: 'mcp',
          repo: undefined,
          npm: '@modelcontextprotocol/server-filesystem',
          commands: undefined,
          tags: undefined,
          configSchema: undefined,
          version: '1.0.0',
          installedAt: 1,
          enabled: true,
          scope: 'global',
          projectPath: undefined,
          config: undefined,
        },
        {
          id: 'get-shit-done',
          name: 'Get Shit Done (GSD)',
          description: 'Autonomous task execution framework',
          type: 'skill',
          repo: undefined,
          npm: undefined,
          commands: ['/gsd:status'],
          tags: ['workflow'],
          configSchema: undefined,
          version: '1.5.0',
          installedAt: 1,
          enabled: true,
          scope: 'global',
          projectPath: undefined,
          config: undefined,
        },
      ],
    }

    mockedUseHealthStatus.mockReturnValue({
      status,
      loading: false,
      refresh: vi.fn(),
    })

    render(<HealthDashboard />)

    expect(screen.getByText('App & Plugin Health')).toBeInTheDocument()
    expect(screen.getByText('WARNING')).toBeInTheDocument()
    expect(screen.getByText('Database')).toBeInTheDocument()
    expect(screen.getByText('Connection ready')).toBeInTheDocument()
    expect(screen.getByText('Filesystem MCP')).toBeInTheDocument()
    expect(screen.getByText('Get Shit Done (GSD)')).toBeInTheDocument()
    expect(screen.getAllByText('enabled · global')).toHaveLength(2)
    expect(screen.getByText('1 active')).toBeInTheDocument()
  })

  it('shows loading pulse when status is loading', () => {
    mockedUseHealthStatus.mockReturnValue({ status: null, loading: true, refresh: vi.fn() })
    render(<HealthDashboard />)
    expect(screen.getByText('Initializing diagnostics...')).toHaveClass('animate-pulse')
  })

  it('shows loading pulse when status is null (not yet loaded)', () => {
    mockedUseHealthStatus.mockReturnValue({ status: null, loading: false, refresh: vi.fn() })
    render(<HealthDashboard />)
    expect(screen.getByText('Initializing diagnostics...')).toBeInTheDocument()
  })

  it('shows diagnostic explainer when services have errors and warnings', () => {
    const status: HealthStatus = {
      cpu_usage: 10,
      memory_usage: 1024 * 1024 * 1024,
      total_memory: 8 * 1024 * 1024 * 1024,
      threads: 4,
      status: 'error',
      services: [
        {
          id: 'database',
          name: 'Database',
          status: 'error',
          detail: 'DB offline',
          diagnostics: [
            { level: 'error', message: 'Connection refused', suggestion: 'Check DB host', code: 'ERR_DB_CONN' },
            { level: 'warning', message: 'Slow queries detected', suggestion: 'Add indexes' },
            { level: 'info', message: 'Using default config' },
          ],
        },
      ],
      installed_extensions: [],
    }
    mockedUseHealthStatus.mockReturnValue({ status, loading: false, refresh: vi.fn() })
    render(<HealthDashboard />)

    expect(screen.getByText('Diagnostic Explainer')).toBeInTheDocument()
    expect(screen.getByText('2 Issues Detected')).toBeInTheDocument()
    expect(screen.getByText('Connection refused')).toBeInTheDocument()
    expect(screen.getByText('Slow queries detected')).toBeInTheDocument()
    // Info level not shown in explainer, only warning/error
  })

  it('expands service diagnostics when row is clicked and service has diagnostics', () => {
    const status: HealthStatus = {
      cpu_usage: 5,
      memory_usage: 512 * 1024 * 1024,
      total_memory: 8 * 1024 * 1024 * 1024,
      threads: 2,
      status: 'warning',
      services: [
        {
          id: 'ai_providers',
          name: 'AI Providers',
          status: 'Warning',
          detail: 'Provider latency high',
          diagnostics: [
            { level: 'warning', message: 'High latency on claude', suggestion: 'Check API status' },
          ],
        },
      ],
      installed_extensions: [],
    }
    mockedUseHealthStatus.mockReturnValue({ status, loading: false, refresh: vi.fn() })
    render(<HealthDashboard />)

    // Before click: expanded is false, diagnostics collapsed
    const aiProviderRows = screen.getAllByText('AI Providers')
    fireEvent.click(aiProviderRows[0])
    expect(screen.getByText('High latency on claude')).toBeInTheDocument()
    expect(screen.getByText('Check API status')).toBeInTheDocument()

    // Collapse
    fireEvent.click(aiProviderRows[0])
  })

  it('renders all service icon variants', () => {
    const status: HealthStatus = {
      cpu_usage: 0,
      memory_usage: 0,
      total_memory: 1,
      threads: 1,
      status: 'healthy',
      services: [
        { id: 'database', name: 'Database Svc', status: 'Healthy', detail: '', diagnostics: [] },
        { id: 'project_capability', name: 'Project Capability', status: 'Healthy', detail: '', diagnostics: [] },
        { id: 'environment', name: 'Environment Svc', status: 'Scanning', detail: '', diagnostics: [] },
        { id: 'ai_providers', name: 'AI Providers Svc', status: 'Healthy', detail: '', diagnostics: [] },
        { id: 'other', name: 'Other Svc', status: 'error', detail: '', diagnostics: [] },
      ],
      installed_extensions: [],
    }
    mockedUseHealthStatus.mockReturnValue({ status, loading: false, refresh: vi.fn() })
    render(<HealthDashboard />)
    expect(screen.getByText('Database Svc')).toBeInTheDocument()
    expect(screen.getByText('Environment Svc')).toBeInTheDocument()
    expect(screen.getByText('Other Svc')).toBeInTheDocument()
  })

  it('renders empty extension fallback messages', () => {
    const status: HealthStatus = {
      cpu_usage: 0,
      memory_usage: 0,
      total_memory: 1,
      threads: 1,
      status: 'healthy',
      services: [],
      installed_extensions: [],
    }
    mockedUseHealthStatus.mockReturnValue({ status, loading: false, refresh: vi.fn() })
    render(<HealthDashboard />)
    expect(screen.getByText('No MCP extensions installed.')).toBeInTheDocument()
    expect(screen.getByText('No non-MCP extensions installed.')).toBeInTheDocument()
  })

  it('shows HEALTHY and SCANNING status colors', () => {
    const makeStatus = (s: string): HealthStatus => ({
      cpu_usage: 0, memory_usage: 0, total_memory: 1, threads: 1,
      status: s, services: [], installed_extensions: [],
    })
    const { rerender } = render(<HealthDashboard />)
    mockedUseHealthStatus.mockReturnValue({ status: makeStatus('healthy'), loading: false, refresh: vi.fn() })
    rerender(<HealthDashboard />)
    expect(screen.getByText('HEALTHY')).toBeInTheDocument()

    mockedUseHealthStatus.mockReturnValue({ status: makeStatus('scanning'), loading: false, refresh: vi.fn() })
    rerender(<HealthDashboard />)
    expect(screen.getByText('SCANNING')).toBeInTheDocument()
  })
})
