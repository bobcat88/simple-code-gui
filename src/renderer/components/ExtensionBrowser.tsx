import React, { useState, useEffect, useCallback } from 'react'
import { 
  X, 
  RefreshCw, 
  Download, 
  Trash2, 
  Settings, 
  Wrench, 
  Plus, 
  Globe, 
  Code, 
  User,
  ExternalLink,
  Search,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  Play
} from 'lucide-react'
import { useExtensionUpdates } from '../hooks/useExtensions'
import { cn } from '../lib/utils'

interface Extension {
  id: string
  name: string
  description: string
  type: 'skill' | 'mcp' | 'agent'
  version?: string
  repo?: string
  npm?: string
  commands?: string[]
  tags?: string[]
  configSchema?: Record<string, any>
}

interface InstalledExtension extends Extension {
  installedAt: number
  version?: string
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
  const { data: updates = [] } = useExtensionUpdates()
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
  const [toolLoading, setToolLoading] = useState(false)

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
        skills: registryData?.skills || [],
        mcps: registryData?.mcps || [],
        agents: registryData?.agents || []
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
    // Find project-specific entry if exists
    const projectExt = installed.find(e => e.id === extId && e.scope === 'project' && e.projectPath === projectPath)
    if (projectExt) return projectExt.enabled
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

      if (!result?.success) {
        setError(result?.error || 'Installation failed')
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
      if (result && !result.success) {
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
      
      const ext = installed.find(e => e.id === extId)
      if (ext?.type === 'mcp') {
        await window.electronAPI?.mcpLoadConfig?.()
      }

      await loadData()
    } catch (e: any) {
      setError(e.message || 'Failed to toggle extension')
    }
  }

  // Remove custom URL
  const handleRemoveCustomUrl = async (url: string) => {
    try {
      await window.electronAPI?.extensionsRemoveCustomUrl?.(url)
      await loadData()
    } catch (e: any) {
      setError(e.message || 'Failed to remove custom URL')
    }
  }

  // Add custom URL
  const handleAddCustomUrl = async () => {
    const url = customUrl.trim()
    if (!url) return
    if (!url.startsWith('https://github.com/')) {
      setError('Only GitHub URLs are supported')
      return
    }

    try {
      setInstalling('custom-url')
      
      // Fetch info
      const extInfo = await window.electronAPI?.extensionsFetchFromUrl?.(url)
      if (!extInfo) {
        setError('Could not fetch extension info from URL')
        return
      }

      // Install
      const result = await window.electronAPI?.extensionsInstallSkill?.(extInfo, 'global')
      if (!result?.success) {
        setError(result?.error || 'Installation failed')
        return
      }

      // Save URL
      await window.electronAPI?.extensionsAddCustomUrl?.(url)
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
    setToolLoading(true)
    setTools([])
    try {
      const result = await window.electronAPI?.mcpListTools?.(ext.id)
      setTools(result?.tools || [])
    } catch (e: any) {
      setError(e.message || 'Failed to list tools')
    } finally {
      setToolLoading(false)
    }
  }

  // Call a tool
  const handleCallTool = async () => {
    if (!browsingTools || !executingTool) return
    setToolLoading(true)
    setToolResult(null)
    try {
      const result = await window.electronAPI?.mcpCallTool?.(browsingTools.id, executingTool.name, toolArgs)
      setToolResult(result)
    } catch (e: any) {
      setError(e.message || 'Tool execution failed')
    } finally {
      setToolLoading(false)
    }
  }

  // Render extension item
  const renderExtensionItem = (ext: Extension) => {
    const installedExt = installed.find(e => e.id === ext.id && e.scope === 'global')
    const isInst = !!installedExt
    const enabled = isEnabledForProject(ext.id)
    const isOps = installing === ext.id || removing === ext.id
    const hasUpdate = updates.find(u => u.id === ext.id)

    return (
      <div key={ext.id} className={cn("extension-item flex items-start gap-4", isOps && "opacity-60")}>
        {isInst && (
          <div className="pt-1">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary focus:ring-primary focus:ring-offset-0 transition-all cursor-pointer"
              checked={enabled}
              onChange={(e) => handleToggle(ext.id, e.target.checked)}
              title={enabled ? "Disable for this project" : "Enable for this project"}
            />
          </div>
        )}
        <div className="extension-info">
          <div className="flex items-center gap-2">
            <span className="extension-name">{ext.name}</span>
            {isInst && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
            {hasUpdate && (
              <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-[10px] text-primary font-bold border border-primary/30 flex items-center gap-1 animate-pulse">
                <RefreshCw className="w-2.5 h-2.5" />
                Update Available
              </span>
            )}
          </div>
          <div className="extension-description">{ext.description}</div>
          {isInst && installedExt.version && (
            <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
              <span>Version {installedExt.version}</span>
              {hasUpdate && (
                <span className="text-primary">→ {hasUpdate.latestVersion}</span>
              )}
            </div>
          )}
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
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
              <a 
                href={ext.repo} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-white transition-colors"
                onClick={(e) => {
                  e.preventDefault()
                  window.electronAPI?.openExternal?.(ext.repo!)
                }}
              >
                <ExternalLink className="w-3 h-3" />
                {ext.repo.replace('https://github.com/', '')}
              </a>
            )}
          </div>
        </div>
        <div className="extension-actions">
          {isInst ? (
            <>
              {ext.type === 'mcp' && (
                <button
                  className="icon-btn"
                  onClick={() => setConfiguring(installedExt)}
                  title="Configure"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
              {ext.type === 'mcp' && (
                <button
                  className="icon-btn"
                  onClick={() => handleBrowseTools(installedExt)}
                  title="Browse Tools"
                >
                  <Wrench className="w-4 h-4" />
                </button>
              )}
              <button
                className="icon-btn danger"
                onClick={() => handleRemove(ext.id)}
                disabled={removing === ext.id}
                title="Remove"
              >
                {removing === ext.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              {ext.repo && customUrls.includes(ext.repo) && (
                <button
                  className="icon-btn danger"
                  onClick={() => handleRemoveCustomUrl(ext.repo!)}
                  title="Remove Source"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                className="install-btn"
                onClick={() => handleInstall(ext)}
                disabled={installing === ext.id}
              >
                {installing === ext.id ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Installing...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Download className="w-3 h-3" />
                    <span>Install</span>
                  </div>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const extensions = getExtensionsForTab()
  const installedForTab = installed.filter(e => {
    if (e.scope !== 'global') return false // Only show global in main list
    if (activeTab === 'skills') return e.type === 'skill'
    if (activeTab === 'mcps') return e.type === 'mcp'
    if (activeTab === 'agents') return e.type === 'agent'
    return false
  })
  
  const availableForTab = (extensions || []).filter(e => !isInstalled(e.id))

  const tabIcons = {
    skills: <Code className="w-4 h-4" />,
    mcps: <Globe className="w-4 h-4" />,
    agents: <User className="w-4 h-4" />
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal extension-browser-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header border-b border-white/5 px-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/20 text-primary">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Extensions</h2>
              <p className="text-xs text-muted-foreground">Manage skills and MCPs for {projectName}</p>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose}><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {error && (
            <div className="extension-error">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
            </div>
          )}

          {/* Add from URL */}
          <div className="add-url-section">
            <div className="flex items-center gap-2 pl-2">
              <Search className="w-4 h-4 text-muted-foreground" />
            </div>
            <input
              type="text"
              placeholder="Paste GitHub URL to add custom skill..."
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCustomUrl()}
            />
            <button
              onClick={handleAddCustomUrl}
              disabled={!customUrl.trim() || installing === 'custom-url'}
              className="flex items-center gap-2"
            >
              {installing === 'custom-url' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add Skill</span>
                </>
              )}
            </button>
          </div>

          {/* Tabs */}
          <div className="extension-tabs">
            {(['skills', 'mcps', 'agents'] as const).map(tab => (
              <button
                key={tab}
                className={cn("flex items-center justify-center gap-2", activeTab === tab && 'active')}
                onClick={() => setActiveTab(tab)}
              >
                {tabIcons[tab]}
                <span className="capitalize">{tab}</span>
              </button>
            ))}
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button
              className="refresh-btn !flex-none !w-10"
              onClick={() => loadData(true)}
              disabled={refreshing}
              title="Refresh registry"
            >
              <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
            </button>
          </div>

          <div className="extension-list custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                <p className="text-muted-foreground font-medium">Fetching extensions...</p>
              </div>
            ) : (
              <>
                {/* Installed section */}
                {installedForTab.length > 0 && (
                  <div className="mb-8">
                    <div className="extension-section-header">Installed</div>
                    <div className="grid grid-cols-1 gap-3 mt-2">
                      {installedForTab.map(renderExtensionItem)}
                    </div>
                  </div>
                )}

                {/* Available section */}
                <div>
                  <div className="extension-section-header">Available</div>
                  <div className="grid grid-cols-1 gap-3 mt-2">
                    {availableForTab.map(renderExtensionItem)}
                  </div>
                </div>

                {installedForTab.length === 0 && availableForTab.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-center px-10">
                    <div className="p-4 rounded-full bg-white/5 mb-4">
                      <Search className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">No {activeTab} found</h3>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      {activeTab === 'skills' 
                        ? 'Try adding a custom skill by pasting a GitHub repository URL in the search bar above.'
                        : `The registry doesn't seem to have any ${activeTab} listed at the moment.`}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* MCP Configuration Modal */}
        {configuring && (
          <div className="config-overlay" onClick={() => setConfiguring(null)}>
            <div className="config-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header border-b border-white/5 px-6 py-4">
                <div className="flex items-center gap-3">
                  <Settings className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-bold">Configure: {configuring.name}</h3>
                </div>
                <button className="icon-btn" onClick={() => setConfiguring(null)}><X className="w-4 h-4" /></button>
              </div>
              
              <div className="config-content">
                <div className="mb-4 flex items-start gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <AlertCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-[11px] leading-relaxed text-primary/90 font-medium">
                    Changes to MCP server configurations require a restart of the Claude Code backend to take full effect. 
                    Ensure the JSON is valid before saving.
                  </p>
                </div>
                
                <div className="relative group">
                  <textarea
                    defaultValue={JSON.stringify(configuring.config || {}, null, 2)}
                    placeholder='{\n  "env": {},\n  "args": []\n}'
                    rows={10}
                    id="mcp-config-textarea"
                    className="w-full bg-[#050505] border border-white/10 rounded-xl p-4 font-mono text-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none"
                  />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-1 rounded-md text-muted-foreground">JSON</span>
                  </div>
                </div>
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
                      
                      if (configuring.type === 'mcp') {
                        await window.electronAPI?.mcpLoadConfig?.()
                      }

                      setConfiguring(null)
                      await loadData()
                    } catch (e) {
                      setError('Invalid JSON configuration. Please check your syntax.')
                    }
                  }}
                >
                  Save Configuration
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
              <div className="modal-header border-b border-white/5 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {executingTool && (
                      <button 
                        className="p-1.5 hover:bg-white/5 rounded-lg text-muted-foreground transition-colors mr-1"
                        onClick={() => setExecutingTool(null)}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    )}
                    <Wrench className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold">
                    {executingTool ? `Run: ${executingTool.name}` : `Tools: ${browsingTools.name}`}
                  </h3>
                </div>
                <button className="icon-btn" onClick={() => {
                  if (executingTool) setExecutingTool(null)
                  else setBrowsingTools(null)
                }}><X className="w-4 h-4" /></button>
              </div>
              
              <div className="config-content !p-0 flex flex-col min-h-0 overflow-hidden">
                {executingTool ? (
                  <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                      <p className="text-sm text-muted-foreground leading-relaxed">{executingTool.description}</p>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Parameters</h4>
                      {Object.entries(executingTool.inputSchema?.properties || {}).length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                          {Object.entries(executingTool.inputSchema?.properties || {}).map(([name, schema]: [string, any]) => {
                            const isRequired = executingTool.inputSchema?.required?.includes(name)
                            const type = schema.type || 'string'
                            
                            return (
                              <div key={name} className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-white flex items-center gap-2">
                                  {name}
                                  {isRequired && <span className="text-destructive">*</span>}
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground font-mono">{type}</span>
                                </label>
                                
                                {type === 'boolean' ? (
                                  <div className="flex items-center gap-3 p-3 rounded-xl bg-[#050505] border border-white/10">
                                    <input
                                      type="checkbox"
                                      className="w-4 h-4 rounded border-white/10 bg-white/5 text-primary focus:ring-primary focus:ring-offset-0 transition-all cursor-pointer"
                                      checked={!!toolArgs[name]}
                                      onChange={(e) => setToolArgs(prev => ({ ...prev, [name]: e.target.checked }))}
                                    />
                                    <span className="text-xs text-muted-foreground">{schema.description || 'Enable this option'}</span>
                                  </div>
                                ) : type === 'number' || type === 'integer' ? (
                                  <input
                                    type="number"
                                    className="bg-[#050505] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                                    placeholder={schema.description || name}
                                    value={toolArgs[name] ?? ''}
                                    onChange={(e) => setToolArgs(prev => ({ ...prev, [name]: e.target.value === '' ? undefined : Number(e.target.value) }))}
                                  />
                                ) : type === 'object' || type === 'array' ? (
                                  <textarea
                                    className="bg-[#050505] border border-white/10 rounded-xl px-4 py-2.5 text-sm font-mono focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none resize-none"
                                    placeholder={schema.description || `Enter JSON ${type}...`}
                                    rows={3}
                                    value={typeof toolArgs[name] === 'object' ? JSON.stringify(toolArgs[name], null, 2) : toolArgs[name] || ''}
                                    onChange={(e) => {
                                      const val = e.target.value
                                      try {
                                        const parsed = JSON.parse(val)
                                        setToolArgs(prev => ({ ...prev, [name]: parsed }))
                                      } catch {
                                        setToolArgs(prev => ({ ...prev, [name]: val }))
                                      }
                                    }}
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    className="bg-[#050505] border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                                    placeholder={schema.description || name}
                                    value={toolArgs[name] || ''}
                                    onChange={(e) => setToolArgs(prev => ({ ...prev, [name]: e.target.value }))}
                                  />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No parameters required for this tool.</p>
                      )}
                    </div>

                    {toolResult && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">Result</h4>
                        <div className="p-4 bg-black/40 rounded-xl border border-white/5 font-mono text-[11px] overflow-x-auto">
                          <pre className="text-primary-foreground/90">{JSON.stringify(toolResult, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                    {toolLoading ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                        <p className="text-muted-foreground font-medium">Fetching tools...</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {tools.map(tool => (
                          <button 
                            key={tool.name} 
                            className="group p-4 bg-white/5 hover:bg-primary/10 border border-white/5 hover:border-primary/30 rounded-xl text-left transition-all duration-300 flex items-center justify-between"
                            onClick={() => {
                              setExecutingTool(tool)
                              setToolArgs({})
                              setToolResult(null)
                            }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm text-white group-hover:text-primary transition-colors">{tool.name}</div>
                              <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{tool.description}</div>
                            </div>
                            <div className="p-2 rounded-lg bg-white/5 text-muted-foreground group-hover:bg-primary group-hover:text-white transition-all opacity-0 group-hover:opacity-100">
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </div>
                          </button>
                        ))}
                        {tools.length === 0 && !toolLoading && (
                          <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Wrench className="w-8 h-8 text-muted-foreground/30 mb-3" />
                            <p className="text-muted-foreground italic text-sm">No tools found for this server.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="config-actions p-6 border-t border-white/5">
                {executingTool ? (
                  <>
                    <button onClick={() => setExecutingTool(null)} className="font-bold">Back to Tools</button>
                    <button className="primary font-bold min-w-[120px]" onClick={handleCallTool} disabled={toolLoading}>
                      {toolLoading ? (
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Running...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Execute Tool</span>
                        </div>
                      )}
                    </button>
                  </>
                ) : (
                  <button onClick={() => setBrowsingTools(null)} className="font-bold">Close Browser</button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

