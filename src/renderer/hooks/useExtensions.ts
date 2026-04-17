import { useQuery } from '@tanstack/react-query'

export interface Extension {
  id: string
  name: string
  description: string
  type: 'skill' | 'mcp' | 'agent'
  repo?: string
  npm?: string
  commands?: string[]
  tags?: string[]
  configSchema?: Record<string, unknown>
}

export interface InstalledExtension extends Extension {
  installedAt: number
  version?: string
  enabled: boolean
  scope: 'global' | 'project'
  projectPath?: string
  config?: Record<string, unknown>
}

export function useExtensions() {
  return useQuery<InstalledExtension[]>({
    queryKey: ['extensions'],
    queryFn: async () => {
      const exts = await window.electronAPI?.extensionsGetInstalled?.()
      return exts || []
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}
