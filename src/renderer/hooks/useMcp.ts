import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface McpServer {
  name: string
  command: string
  args: string[]
  env: Record<string, string>
}

export interface McpTool {
  name: string
  description?: string
  inputSchema: any
}

export interface McpResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export function useMcp() {
  const queryClient = useQueryClient()

  const serversQuery = useQuery({
    queryKey: ['mcp-servers'],
    queryFn: async () => {
      if (window.electronAPI?.mcpGetServers) {
        return await window.electronAPI.mcpGetServers() as McpServer[]
      }
      return []
    }
  })

  const loadConfigMutation = useMutation({
    mutationFn: async () => {
      if (window.electronAPI?.mcpLoadConfig) {
        await window.electronAPI.mcpLoadConfig()
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })
    }
  })

  const listTools = async (serverName: string) => {
    if (window.electronAPI?.mcpListTools) {
      const res = await window.electronAPI.mcpListTools(serverName)
      return (res?.tools || []) as McpTool[]
    }
    return []
  }

  const callTool = async (serverName: string, toolName: string, args: any) => {
    if (window.electronAPI?.mcpCallTool) {
      return await window.electronAPI.mcpCallTool(serverName, toolName, args)
    }
    throw new Error('MCP Call Tool not available')
  }

  const listResources = async (serverName: string) => {
    if (window.electronAPI?.mcpListResources) {
      const res = await window.electronAPI.mcpListResources(serverName)
      return (res?.resources || []) as McpResource[]
    }
    return []
  }

  const readResource = async (serverName: string, uri: string) => {
    if (window.electronAPI?.mcpReadResource) {
      return await window.electronAPI.mcpReadResource(serverName, uri)
    }
    throw new Error('MCP Read Resource not available')
  }

  return {
    servers: serversQuery.data || [],
    isLoading: serversQuery.isLoading,
    loadConfig: loadConfigMutation.mutate,
    isLoadingConfig: loadConfigMutation.isPending,
    listTools,
    callTool,
    listResources,
    readResource
  }
}
