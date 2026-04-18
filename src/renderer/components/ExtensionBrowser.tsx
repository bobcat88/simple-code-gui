import React, { useState, useEffect, useCallback } from 'react'

interface Extension {
  id: string
  name: string
  description: string
  type: 'skill' | 'mcp' | 'agent'
  repo?: string
  npm?: string
  commands?: string[]
  tags?: string[]
  configSchema?: Record<string, any>
}

interface InstalledExtension extends Extension {
  installedAt: number
  enabled: boolean
  scope: 'global' | 'project'
  projectPath?: string
  config?: Record<string, any>
}

interface ExtensionBrowserProps {
  projectPath: string
  projectName: string
  onClose: () => void
}

type TabType = 'skills' | 'mcps' | 'agents'

export function ExtensionBrowser({ projectPath, projectName, onClose }: ExtensionBrowserProps) {
  const [activeTab, setActiveTab] = useState<TabType>('skills')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Data
  const [registry, setRegistry] = useState<{
    skills: Extension[]
    mcps: Extension[]
    agents: Extension[]
  }>({ skills: [], mcps: [], agents: [] })
  const [installed, setInstalled] = useState<InstalledExtension[]>([])
  const [customUrl, setCustomUrl] = useState('')
  const [customUrls, setCustomUrls] = useState<string[]>([])

  // Operation states
  const [installing, setInstalling] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [configuring, setConfiguring] = useState<InstalledExtension | null>(null)
  const [browsingTools, setBrowsingTools] = useState<InstalledExtension | null>(null)
  const [tools, setTools] = useState<any[]>([])
  const [executingTool, setExecutingTool] = useState<any | null>(null)
  const [toolArgs, setToolArgs] = useState<Record<string, any>>({})
  const [toolResult, setToolResult] = useState<any | null>(null)

  // Load data
  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(!forceRefresh)
      setRefreshing(forceRefresh)
      setError(null)

      const [registryData, installedData, urlsData] = await Promise.all([
        window.electronAPI?.extensionsFetchRegistry?.(forceRefresh),
        window.electronAPI?.extensionsGetInstalled?.(),
        window.electronAPI?.extensionsGetCustomUrls?.()
      ])

      setRegistry({
        skills: registryData.skills || [],
        mcps: registryData.mcps || [],
        agents: registryData.agents || []
      })
      setInstalled((installedData || []).map((e: any) => ({
        ...e,
        installedAt: e.installedAt || Date.now(),
        enabled: e.enabled !== false,
        scope: e.scope || 'global',
        description: e.description || ''
      })))
      setCustomUrls(urlsData || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load extensions')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Get extensions for current tab
  const getExtensionsForTab = () => {
    switch (activeTab) {
      case 'skills': return registry.skills
      case 'mcps': return registry.mcps
      case 'agents': return registry.agents
    }
  }

  // Check if extension is installed
  const isInstalled = (extId: string) => {
    return installed.some(e => e.id === extId)
  }

  // Check if extension is enabled for this project
  const isEnabledForProject = (extId: string) => {
    const ext = installed.find(e => e.id === extId)
    if (!ext) return false
    if (ext.scope === 'project' && ext.projectPath === projectPath) return true
    return ext.enabled
  }

  // Install extension
  const handleInstall = async (ext: Extension) => {
    setInstalling(ext.id)
    try {
      let result
      if (ext.type === 'skill' || ext.type === 'agent') {
        result = await window.electronAPI?.extensionsInstallSkill?.(ext, 'global')
      } else {
        result = await window.electronAPI?.extensionsInstallMcp?.(ext)
      }

      if (!result.success) {
        setError(result.error || 'Installation failed')
      } else {
        await loadData()
      }
    } catch (e: any) {
      setError(e.message || 'Installation failed')
    } finally {
      setInstalling(null)
    }
  }

  // Remove extension
  const handleRemove = async (extId: string) => {
    setRemoving(extId)
    try {
      const result = await window.electronAPI?.extensionsRemove?.(extId)
      if (!result?.success) {
        setError(result.error || 'Removal failed')
      } else {
        await loadData()
      }
    } catch (e: any) {
      setError(e.message || 'Removal failed')
    } finally {
      setRemoving(null)
    }
  }

  // Toggle extension for project
  const handleToggle = async (extId: string, enabled: boolean) => {
    try {
      if (enabled) {
        await window.electronAPI?.extensionsEnableForProject?.(extId, projectPath)
      } else {
        await window.electronAPI?.extensionsDisableForProject?.(extId, projectPath)
      }
      await loadData()
    } catch (e: any) {
      setError(e.message || 'Failed to toggle extension')
    }
  }

  // Add custom URL
  const handleAddCustomUrl = async () => {
    if (!customUrl.trim()) return

    try {
      setInstalling('custom-url')

      // First fetch info from the URL
      const extInfo = await window.electronAPI?.extensionsFetchFromUrl?.(customUrl.trim())
      if (!extInfo) {
        setError('Could not fetch extension info from URL')
        return
      }

      // Install it
      const result = await window.electronAPI?.extensionsInstallSkill?.(extInfo, 'global')
      if (!result?.success) {
        setError(result?.error || 'Installation failed')
        return
      }

      // Save the custom URL
      await window.electronAPI?.extensionsAddCustomUrl?.(customUrl.trim())
      setCustomUrl('')
      await loadData()
    } catch (e: any) {
      setError(e.message || 'Failed to add custom URL')
    } finally {
      setInstalling(null)
    }
  }

  // Fetch tools for an MCP
  const handleBrowseTools = async (ext: InstalledExtension) => {
    setBrowsingTools(ext)
    setLoading(true)
    try {
      const result = await window.electronAPI?.mcpListTools?.(ext.name)
      setTools(result?.tools || [])
    } catch (e: any) {
      setError(e.message || 'Failed to list tools')
    } finally {
      setLoading(false)
    }
  }

  // Call a tool
  const handleCallTool = async () => {
    if (!browsingTools || !executingTool) return
    setLoading(true)
    setToolResult(null)
    try {
      const result = await window.electronAPI?.mcpCallTool?.(browsingTools.name, executingTool.name, toolArgs)
      setToolResult(result)
    } catch (e: any) {
      setError(e.message || 'Tool execution failed')
    } finally {
      setLoading(false)
    }
  }

  // Render extension item
  const renderExtensionItem = (ext: Extension) => {
    const installedExt = installed.find(e => e.id === ext.id)
    const isInst = !!installedExt
    const enabled = isEnabledForProject(ext.id)

    return (
      <div key={ext.id} className="extension-item">
        <div className="extension-header">
          {isInst && (
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => handleToggle(ext.id, e.target.checked)}
              title="Enable for this project"
            />
          )}
          <div className="extension-info">
            <div className="extension-name">{ext.name}</div>
            <div className="extension-description">{ext.description}</div>
            {ext.commands && ext.commands.length > 0 && (
              <div className="extension-commands">
                {ext.commands.slice(0, 3).map(cmd => (
                  <span key={cmd} className="command-tag">{cmd}</span>
                ))}
                {ext.commands.length > 3 && (
                  <span className="command-tag more">+{ext.commands.length - 3}</span>
                )}
              </div>
            )}
            {ext.repo && (
              <div className="extension-repo">{ext.repo.replace('https://github.com/', '')}</div>
            )}
          </div>
          <div className="extension-actions">
            {isInst ? (
              <>
                {installedExt?.type === 'mcp' && (
                  <button
                    className="icon-btn"
                    onClick={() => setConfiguring(installedExt)}
                    title="Configure"
                  >
                    <span>⚙</span>
                  </button>
                )}
                {installedExt?.type === 'mcp' && (
                  <button
                    className="icon-btn"
                    onClick={() => handleBrowseTools(installedExt)}
                    title="Browse Tools"
                  >
                    <span>🛠</span>
                  </button>
                )}
                <button
                  className="icon-btn danger"
                  onClick={() => handleRemove(ext.id)}
                  disabled={removing === ext.id}
                  title="Remove"
                >
                  {removing === ext.id ? <span className="spinner">...</span> : <span>🗑</span>}
                </button>
              </>
            ) : (
              <button
                className="install-btn"
                onClick={() => handleInstall(ext)}
                disabled={installing === ext.id}
              >
                {installing === ext.id ? 'Installing...' : 'Install'}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const extensions = getExtensionsForTab()
  const installedForTab = installed.filter(e => {
    if (activeTab === 'skills') return e.type === 'skill'
    if (activeTab === 'mcps') return e.type === 'mcp'
    if (activeTab === 'agents') return e.type === 'agent'
    return false
  })
  const availableForTab = extensions.filter(e => !isInstalled(e.id))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal extension-browser-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Extensions: {projectName}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          {error && (
            <div className="extension-error">
              {error}
              <button onClick={() => setError(null)}>×</button>
            </div>
          )}

          {/* Add from URL */}
          <div className="add-url-section">
            <input
              type="text"
              placeholder="Add from GitHub URL..."
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustomUrl()}
            />
            <button
              onClick={handleAddCustomUrl}
              disabled={!customUrl.trim() || installing === 'custom-url'}
            >
              {installing === 'custom-url' ? 'Adding...' : 'Add'}
            </button>
          </div>

          {/* Tabs */}
          <div className="extension-tabs">
            <button
              className={activeTab === 'skills' ? 'active' : ''}
              onClick={() => setActiveTab('skills')}
            >
              Skills
            </button>
            <button
              className={activeTab === 'mcps' ? 'active' : ''}
              onClick={() => setActiveTab('mcps')}
            >
              MCPs
            </button>
            <button
              className={activeTab === 'agents' ? 'active' : ''}
              onClick={() => setActiveTab('agents')}
            >
              Agents
            </button>
            <button
              className="refresh-btn"
              onClick={() => loadData(true)}
              disabled={refreshing}
              title="Refresh registry"
            >
              {refreshing ? '...' : '↻'}
            </button>
          </div>

          {loading ? (
            <div className="extension-loading">Loading extensions...</div>
          ) : (
            <div className="extension-list">
              {/* Installed section */}
              {installedForTab.length > 0 && (
                <>
                  <div className="extension-section-header">Installed</div>
                  {installedForTab.map(renderExtensionItem)}
                </>
              )}

              {/* Available section */}
              {availableForTab.length > 0 && (
                <>
                  <div className="extension-section-header">Available</div>
                  {availableForTab.map(renderExtensionItem)}
                </>
              )}

              {installedForTab.length === 0 && availableForTab.length === 0 && (
                <div className="extension-empty">
                  No {activeTab} available yet.
                  {activeTab === 'skills' && ' Add one from a GitHub URL above.'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* MCP Configuration Modal */}
        {configuring && (
          <div className="config-overlay" onClick={() => setConfiguring(null)}>
            <div className="config-modal" onClick={e => e.stopPropagation()}>
              <h3>Configure: {configuring.name}</h3>
              <p className="hint">
                MCP configuration changes require restarting Claude Code to take effect.
              </p>
              <div className="config-content">
                <textarea
                  defaultValue={JSON.stringify(configuring.config || {}, null, 2)}
                  placeholder='{"key": "value"}'
                  rows={8}
                  id="mcp-config-textarea"
                />
              </div>
              <div className="config-actions">
                <button onClick={() => setConfiguring(null)}>Cancel</button>
                <button
                  className="primary"
                  onClick={async () => {
                    const textarea = document.getElementById('mcp-config-textarea') as HTMLTextAreaElement
                    try {
                      const config = JSON.parse(textarea.value || '{}')
                      await window.electronAPI?.extensionsSetConfig?.(configuring.id, config)
                      setConfiguring(null)
                      await loadData()
                    } catch (e) {
                      setError('Invalid JSON configuration')
                    }
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
        {/* MCP Tools Modal */}
        {browsingTools && (
          <div className="config-overlay" onClick={() => {
            if (executingTool) setExecutingTool(null)
            else setBrowsingTools(null)
          }}>
            <div className="config-modal tools-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{executingTool ? `Run: ${executingTool.name}` : `Tools: ${browsingTools.name}`}</h3>
                <button className="modal-close" onClick={() => {
                  if (executingTool) setExecutingTool(null)
                  else setBrowsingTools(null)
                }}>×</button>
              </div>
              
              <div className="config-content overflow-y-auto max-h-[60vh] p-4">
                {executingTool ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">{executingTool.description}</p>
                    
                    <div className="space-y-3">
                      {Object.entries(executingTool.inputSchema?.properties || {}).map(([name, schema]: [string, any]) => (
                        <div key={name} className="flex flex-col gap-1">
                          <label className="text-xs font-bold">{name}{executingTool.inputSchema?.required?.includes(name) && '*'}</label>
                          <input
                            type="text"
                            className="bg-muted/50 border border-border rounded px-2 py-1.5 text-sm"
                            placeholder={schema.description || name}
                            value={toolArgs[name] || ''}
                            onChange={(e) => setToolArgs(prev => ({ ...prev, [name]: e.target.value }))}
                          />
                        </div>
                      ))}
                    </div>

                    {toolResult && (
                      <div className="mt-4 p-3 bg-black/20 rounded-lg border border-white/5 font-mono text-xs overflow-x-auto">
                        <pre>{JSON.stringify(toolResult, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tools.map(tool => (
                      <div 
                        key={tool.name} 
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 cursor-pointer transition-colors"
                        onClick={() => {
                          setExecutingTool(tool)
                          setToolArgs({})
                          setToolResult(null)
                        }}
                      >
                        <div className="font-bold text-sm">{tool.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{tool.description}</div>
                      </div>
                    ))}
                    {tools.length === 0 && !loading && (
                      <div className="text-center py-8 text-muted-foreground italic">No tools found for this server.</div>
                    )}
                  </div>
                )}
              </div>

              <div className="config-actions p-4 border-t border-white/5">
                {executingTool ? (
                  <>
                    <button onClick={() => setExecutingTool(null)}>Back</button>
                    <button className="primary" onClick={handleCallTool} disabled={loading}>
                      {loading ? 'Running...' : 'Run Tool'}
                    </button>
                  </>
                ) : (
                  <button onClick={() => setBrowsingTools(null)}>Close</button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
