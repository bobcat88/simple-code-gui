import { useQuery } from '@tanstack/react-query'

export interface Extension {
  id: string
  name: string
  description: string
  type: 'skill' | 'mcp' | 'agent'
  version?: string
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
      return (exts || []) as unknown as InstalledExtension[]
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}
export function useExtensionUpdates() {
  return useQuery({
    queryKey: ['extension-updates'],
    queryFn: async () => {
      const updates = await window.electronAPI?.extensionsCheckUpdates?.()
      return updates || []
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  })
}
