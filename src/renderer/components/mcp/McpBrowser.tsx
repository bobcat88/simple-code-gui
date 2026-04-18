import React, { useState, useEffect } from 'react'
import { useMcp, McpTool, McpResource } from '../../hooks/useMcp'
import './McpBrowser.css'

interface McpBrowserProps {
  onClose: () => void
}

export function McpBrowser({ onClose }: McpBrowserProps) {
  const { servers, isLoading, listTools, listResources, callTool, readResource } = useMcp()
  const [selectedServer, setSelectedServer] = useState<string | null>(null)
  const [tools, setTools] = useState<McpTool[]>([])
  const [resources, setResources] = useState<McpResource[]>([])
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [activeTab, setActiveTab] = useState<'tools' | 'resources'>('tools')
  
  const [executingTool, setExecutingTool] = useState<McpTool | null>(null)
  const [toolArgs, setToolArgs] = useState<Record<string, any>>({})
  const [toolResult, setToolResult] = useState<any | null>(null)
  const [runningTool, setRunningTool] = useState(false)

  const [viewingResource, setViewingResource] = useState<McpResource | null>(null)
  const [resourceContent, setResourceContent] = useState<any | null>(null)
  const [loadingResource, setLoadingResource] = useState(false)

  useEffect(() => {
    if (selectedServer) {
      loadServerDetails(selectedServer)
    }
  }, [selectedServer])

  const loadServerDetails = async (serverName: string) => {
    setLoadingDetails(true)
    try {
      const [toolList, resourceList] = await Promise.all([
        listTools(serverName),
        listResources(serverName)
      ])
      setTools(toolList)
      setResources(resourceList)
    } catch (e) {
      console.error('Failed to load server details', e)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleRunTool = async () => {
    if (!selectedServer || !executingTool) return
    setRunningTool(true)
    setToolResult(null)
    try {
      const result = await callTool(selectedServer, executingTool.name, toolArgs)
      setToolResult(result)
    } catch (e: any) {
      setToolResult({ error: e.message || 'Execution failed' })
    } finally {
      setRunningTool(false)
    }
  }

  const handleViewResource = async (resource: McpResource) => {
    if (!selectedServer) return
    setViewingResource(resource)
    setLoadingResource(true)
    setResourceContent(null)
    try {
      const content = await readResource(selectedServer, resource.uri)
      setResourceContent(content)
    } catch (e: any) {
      setResourceContent({ error: e.message || 'Failed to read resource' })
    } finally {
      setLoadingResource(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal mcp-browser-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔌</span>
            <h2>MCP Tool Browser</h2>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-content flex h-[600px]">
          {/* Server List */}
          <div className="w-1/3 border-r border-white/5 p-4 overflow-y-auto bg-black/10">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Servers</h3>
            {isLoading ? (
              <div className="p-4 text-center italic text-sm text-muted-foreground">Discovering...</div>
            ) : (
              <div className="space-y-2">
                {servers.map(server => (
                  <button
                    key={server.name}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedServer === server.name 
                        ? 'bg-blue-600/20 border-blue-500/50 text-white' 
                        : 'bg-white/5 border-white/5 hover:bg-white/10 text-muted-foreground hover:text-white'
                    }`}
                    onClick={() => setSelectedServer(server.name)}
                  >
                    <div className="font-bold text-sm">{server.name}</div>
                    <div className="text-[10px] opacity-50 font-mono truncate">{server.command}</div>
                  </button>
                ))}
                {servers.length === 0 && (
                  <div className="p-8 text-center border border-dashed border-white/10 rounded-xl">
                    <div className="text-2xl mb-2">🤷‍♂️</div>
                    <div className="text-sm text-muted-foreground">No MCP servers found. Check your config.</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Details Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedServer ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                <div className="text-5xl mb-4">⚡</div>
                <h3 className="text-xl font-bold text-white mb-2">Select a Server</h3>
                <p className="max-w-xs text-sm">Pick an MCP server from the list to explore its tools and resources.</p>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex border-b border-white/5 p-1 bg-black/20">
                  <button
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                      activeTab === 'tools' ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white/80'
                    }`}
                    onClick={() => setActiveTab('tools')}
                  >
                    Tools ({tools.length})
                  </button>
                  <button
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                      activeTab === 'resources' ? 'bg-white/10 text-white' : 'text-muted-foreground hover:text-white/80'
                    }`}
                    onClick={() => setActiveTab('resources')}
                  >
                    Resources ({resources.length})
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {loadingDetails ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm text-muted-foreground">Loading {activeTab}...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {activeTab === 'tools' ? (
                        tools.map(tool => (
                          <div 
                            key={tool.name}
                            className="p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-colors group cursor-pointer"
                            onClick={() => {
                              setExecutingTool(tool)
                              setToolArgs({})
                              setToolResult(null)
                            }}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-bold text-blue-400 group-hover:text-blue-300">{tool.name}</h4>
                              <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded uppercase tracking-tighter">Tool</span>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{tool.description || 'No description provided.'}</p>
                          </div>
                        ))
                      ) : (
                        resources.map(resource => (
                          <div 
                            key={resource.uri}
                            className="p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-colors group cursor-pointer"
                            onClick={() => handleViewResource(resource)}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-bold text-green-400 group-hover:text-green-300">{resource.name}</h4>
                              <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded uppercase tracking-tighter">Resource</span>
                            </div>
                            <div className="text-[10px] font-mono text-muted-foreground mb-1 truncate">{resource.uri}</div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{resource.description || 'No description provided.'}</p>
                          </div>
                        ))
                      )}
                      
                      {((activeTab === 'tools' && tools.length === 0) || (activeTab === 'resources' && resources.length === 0)) && (
                        <div className="text-center py-12 text-muted-foreground italic">
                          No {activeTab} available for this server.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tool Execution Overlay */}
        {executingTool && (
          <div className="tool-exec-overlay" onClick={() => setExecutingTool(null)}>
            <div className="tool-exec-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="flex items-center gap-2">
                  <span className="text-blue-400">🛠</span>
                  <h3>Run Tool: {executingTool.name}</h3>
                </div>
                <button className="modal-close" onClick={() => setExecutingTool(null)}>×</button>
              </div>
              <div className="modal-content p-6 overflow-y-auto max-h-[70vh]">
                <p className="text-sm text-muted-foreground mb-6">{executingTool.description}</p>
                
                <div className="space-y-4">
                  {Object.entries(executingTool.inputSchema?.properties || {}).map(([name, schema]: [string, any]) => (
                    <div key={name} className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-baseline">
                        <label className="text-xs font-bold text-white/80">
                          {name}
                          {executingTool.inputSchema?.required?.includes(name) && <span className="text-red-400 ml-1">*</span>}
                        </label>
                        <span className="text-[10px] text-muted-foreground">{schema.type}</span>
                      </div>
                      <input
                        type="text"
                        className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:border-blue-500/50 focus:outline-none transition-colors"
                        placeholder={schema.description || name}
                        value={toolArgs[name] || ''}
                        onChange={(e) => setToolArgs(prev => ({ ...prev, [name]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>

                {toolResult && (
                  <div className="mt-8">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Result</h4>
                    <div className="bg-black/60 rounded-xl border border-white/5 p-4 font-mono text-xs overflow-x-auto shadow-inner">
                      <pre className="text-blue-200">{JSON.stringify(toolResult, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer flex justify-end gap-3 p-4 border-t border-white/5 bg-white/5">
                <button 
                  className="px-4 py-2 rounded-lg hover:bg-white/5 text-sm transition-colors"
                  onClick={() => setExecutingTool(null)}
                >
                  Cancel
                </button>
                <button 
                  className="primary px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleRunTool} 
                  disabled={runningTool}
                >
                  {runningTool ? 'Running...' : 'Execute Tool'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Resource View Overlay */}
        {viewingResource && (
          <div className="tool-exec-overlay" onClick={() => setViewingResource(null)}>
            <div className="tool-exec-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div className="flex items-center gap-2">
                  <span className="text-green-400">📄</span>
                  <h3>Resource: {viewingResource.name}</h3>
                </div>
                <button className="modal-close" onClick={() => setViewingResource(null)}>×</button>
              </div>
              <div className="modal-content p-6 overflow-y-auto max-h-[70vh]">
                <div className="text-[10px] font-mono text-muted-foreground mb-2">{viewingResource.uri}</div>
                <p className="text-sm text-muted-foreground mb-6">{viewingResource.description}</p>
                
                {loadingResource ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-muted-foreground">Reading resource...</span>
                  </div>
                ) : resourceContent && (
                  <div className="bg-black/60 rounded-xl border border-white/5 p-4 font-mono text-xs overflow-x-auto shadow-inner">
                    <pre className="text-green-200">
                      {typeof resourceContent === 'string' 
                        ? resourceContent 
                        : JSON.stringify(resourceContent, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
              <div className="modal-footer p-4 border-t border-white/5 bg-white/5 flex justify-end">
                <button 
                  className="px-6 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-all"
                  onClick={() => setViewingResource(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
