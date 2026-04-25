import { render, screen } from '@testing-library/react'
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
})
