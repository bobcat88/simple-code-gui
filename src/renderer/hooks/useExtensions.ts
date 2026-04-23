import { useQuery } from '@tanstack/react-query'
import { useApi } from '../contexts/ApiContext'

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
  const api = useApi()
  return useQuery<InstalledExtension[]>({
    queryKey: ['extensions'],
    queryFn: async () => {
      const exts = await api.extensionsGetInstalled?.()
      return (exts || []) as unknown as InstalledExtension[]
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}
export function useExtensionUpdates() {
  const api = useApi()
  return useQuery({
    queryKey: ['extension-updates'],
    queryFn: async () => {
      const updates = await api.extensionsCheckUpdates?.()
      return updates || []
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  })
}
