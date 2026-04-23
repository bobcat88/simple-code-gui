import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApi } from '../contexts/ApiContext'

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
  const api = useApi()
  const queryClient = useQueryClient()

  const serversQuery = useQuery({
    queryKey: ['mcp-servers'],
    queryFn: async () => {
      if (api.mcpGetServers) {
        return await api.mcpGetServers() as McpServer[]
      }
      return []
    }
  })

  const loadConfigMutation = useMutation({
    mutationFn: async () => {
      if (api.mcpLoadConfig) {
        await api.mcpLoadConfig()
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp-servers'] })
    }
  })

  const listTools = async (serverName: string) => {
    if (api.mcpListTools) {
      const res = await api.mcpListTools(serverName)
      return (res?.tools || []) as McpTool[]
    }
    return []
  }

  const callTool = async (serverName: string, toolName: string, args: any) => {
    if (api.mcpCallTool) {
      return await api.mcpCallTool(serverName, toolName, args)
    }
    throw new Error('MCP Call Tool not available')
  }

  const listResources = async (serverName: string) => {
    if (api.mcpListResources) {
      const res = await api.mcpListResources(serverName)
      return (res?.resources || []) as McpResource[]
    }
    return []
  }

  const readResource = async (serverName: string, uri: string) => {
    if (api.mcpReadResource) {
      return await api.mcpReadResource(serverName, uri)
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
