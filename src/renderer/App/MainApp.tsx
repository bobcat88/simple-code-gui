import React, { useEffect, useState, useCallback, useRef, RefObject } from 'react'
import { TitleBar } from '../components/TitleBar'
import { Sidebar } from '../components/Sidebar'
import { TerminalTabs } from '../components/TerminalTabs'
import { Terminal } from '../components/terminal/Terminal'
import { TiledTerminalView } from '../components/tiled/index.js'
import { SettingsModal } from '../components/SettingsModal'
import { ProjectInitializationWizard } from '../components/ProjectInitializationWizard'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { FileBrowser } from '../components/mobile/FileBrowser'
import type { HostConfig } from '../hooks/useHostConnection'
import { useWorkspaceStore } from '../stores/workspace'
import { useVoice } from '../contexts/VoiceContext'
import { useModals } from '../contexts/ModalContext'
import {
  useInstallation,
  useUpdater,
  useViewState,
  useWorkspaceLoader,
  useSessionPolling,
  useApiListeners,
  useProjectHandlers
} from '../hooks'
import type { Api } from '../api'
import { InstallationPrompt } from './InstallationPrompt'
import { MobileConnectModal } from './MobileConnectModal'
import { IconBar } from '../components/IconBar'
import { Header } from '../components/Header'
import {  HelpCircle,
  LayoutGrid,
  MessageSquare
} from 'lucide-react'
import { cn } from '../lib/utils'
import { Spotlight } from '../components/Spotlight'
import { IntelligenceSidebar } from '../components/intelligence/IntelligenceSidebar'
import { useProjectIntelligence } from '../hooks/useProjectIntelligence'
import { Activity } from 'lucide-react'
import { TranscriptionOverlay } from '../components/voice/TranscriptionOverlay'

export interface MainAppProps {
  api: Api
  isElectron: boolean
  isTauri?: boolean
  onDisconnect?: () => void
}

export function MainApp({ api, isElectron, isTauri, onDisconnect }: MainAppProps): React.ReactElement {
  const {
    projects,
    openTabs,
    activeTabId,
    categories,
    addProject,
    removeProject,
    updateProject,
    addTab,
    removeTab,
    updateTab,
    setActiveTab
  } = useWorkspaceStore()

  const { voiceOutputEnabled, setProjectVoice } = useVoice()
  const voiceOutputEnabledRef = useRef(voiceOutputEnabled)

  // Modal state from context
  const { settingsOpen, projectWizardOpen, openSettings, closeSettings, openProjectWizard, closeProjectWizard } = useModals()

  // Installation state from hook
  const {
    claudeInstalled,
    npmInstalled,
    gitBashInstalled,
    installing,
    installError,
    installMessage,
    checkInstallation,
    handleInstallNode,
    handleInstallGit,
    handleInstallClaude
  } = useInstallation(api)

  const activeTab = openTabs.find(t => t.id === activeTabId) || null

  const handleNewSessionFromHeader = () => {
    if (activeTab) {
      handleOpenSession(activeTab.projectPath, undefined, undefined, undefined, true)
    } else if (projects.length > 0) {
      handleOpenSession(projects[0].path, undefined, undefined, undefined, true)
    }
  }

  // Updater state from hook
  const { appVersion, updateStatus, downloadUpdate, installUpdate } = useUpdater()

  // View state from hook
  const {
    viewMode,
    tileTree,
    lastFocusedTabId,
    sidebarWidth,
    sidebarCollapsed,
    setViewMode,
    setTileTree,
    setLastFocusedTabId,
    setSidebarWidth,
    setSidebarCollapsed,
    intelligenceWidth,
    intelligenceCollapsed,
    setIntelligenceWidth,
    setIntelligenceCollapsed,
    toggleViewMode
  } = useViewState()

  const { intelligence, loading: intelligenceLoading, refresh: refreshIntelligence } = useProjectIntelligence(
    api as any,
    activeTab?.projectPath || null
  )

  // Workspace loader hook
  const {
    loading,
    currentTheme,
    settings,
    setCurrentTheme,
    setSettings
  } = useWorkspaceLoader({
    api,
    checkInstallation,
    setViewMode,
    setTileTree
  })

  // Session polling hook
  useSessionPolling({ api, openTabs, updateTab })

  // API listeners hook
  useApiListeners({
    api,
    projects,
    settings,
    addTab,
    updateTab,
    setActiveTab
  })

  // Project handlers hook
  const {
    handleAddProject,
    handleAddProjectsFromParent,
    handleOpenSession,
    handleOpenSessionAtPosition,
    handleAddTabToTile,
    handleCloseTab,
    handleCloseProjectTabs,
    handleProjectCreated,
    handleUndoCloseTab,
    canUndoCloseTab
  } = useProjectHandlers({
    api,
    projects,
    openTabs,
    settings,
    tileTree,
    addProject,
    removeTab,
    addTab,
    setActiveTab,
    setTileTree
  })

  const handleRenameTab = useCallback((id: string, title: string) => {
    updateTab(id, { title, customTitle: true })
  }, [updateTab])

  // App-specific state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [mobileConnectOpen, setMobileConnectOpen] = useState(false)
  const [showFileBrowser, setShowFileBrowser] = useState(false)
  const [fileBrowserPath, setFileBrowserPath] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState('terminal')
  const [settingsCategory, setSettingsCategory] = useState('general')
  const isMobile = !isElectron
  const hadProjectsRef = useRef(false)
  const terminalContainerRef = useRef<HTMLDivElement>(null)
  const [spotlightOpen, setSpotlightOpen] = useState(false)

  // Spotlight Hotkey (Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSpotlightOpen(prev => !prev)
      }
      if (e.key === 'Escape' && spotlightOpen) {
        setSpotlightOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [spotlightOpen])

  // Load MCP config on mount
  useEffect(() => {
    if (isTauri && api.mcpLoadConfig) {
      api.mcpLoadConfig().catch(err => {
        console.error('Failed to load MCP config:', err);
      });
    }
  }, [api, isTauri]);

  // Keep ref in sync for callbacks
  useEffect(() => {
    voiceOutputEnabledRef.current = voiceOutputEnabled
  }, [voiceOutputEnabled])

  // Apply per-project voice settings when active tab changes
  useEffect(() => {
    if (!activeTabId) {
      setProjectVoice(null)
      return
    }
    const activeTab = openTabs.find(t => t.id === activeTabId)
    if (!activeTab) {
      setProjectVoice(null)
      return
    }
    const project = projects.find(p => p.path === activeTab.projectPath)
    if (project?.ttsVoice && project?.ttsEngine) {
      setProjectVoice({ ttsVoice: project.ttsVoice, ttsEngine: project.ttsEngine })
    } else {
      setProjectVoice(null)
    }
  }, [activeTabId, openTabs, projects, setProjectVoice])

  // Save workspace when it changes
  useEffect(() => {
    if (!loading) {
      const hadProjects = sessionStorage.getItem('hadProjects') === 'true' || hadProjectsRef.current

      if (projects.length === 0 && hadProjects) {
        console.warn('Skipping save: projects empty but previously had projects (likely hot reload)')
        return
      }

      if (projects.length > 0) {
        hadProjectsRef.current = true
        sessionStorage.setItem('hadProjects', 'true')
      }

      api.saveWorkspace({
        projects,
        openTabs: openTabs.map(t => ({
          id: t.id,
          projectPath: t.projectPath,
          sessionId: t.sessionId,
          title: t.title,
          customTitle: t.customTitle || undefined,
          ptyId: t.ptyId,
          backend: t.backend
        })),
        activeTabId,
        viewMode,
        tileTree: tileTree || undefined,
        categories
      })
    }
  }, [api, projects, openTabs, activeTabId, loading, viewMode, tileTree, categories])

  // Mobile drawer handlers
  const openMobileDrawer = useCallback(() => {
    setMobileDrawerOpen(true)
  }, [])

  const closeMobileDrawer = useCallback(() => {
    setMobileDrawerOpen(false)
  }, [])

  // Open file browser (mobile only)
  const handleOpenFileBrowser = useCallback((projectPath?: string) => {
    setFileBrowserPath(projectPath || null)
    setShowFileBrowser(true)
  }, [])

  if (loading) {
    return (
      <div className="app">
        <div className="empty-state" role="status" aria-live="polite">
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-row h-screen w-screen bg-transparent">
      <div className="flex-1 flex flex-row bg-background/60 backdrop-blur-2xl text-foreground overflow-hidden shadow-2xl relative app-container">
        {!isMobile && (
          <div className="animate-entry delay-100 h-full flex flex-row">
            <IconBar 
              activeSection={activeSection} 
              onSectionChange={setActiveSection}
              activeTabId={activeTabId}
              focusedTabId={lastFocusedTabId}
              onOpenSettings={openSettings}
            />
          </div>
        )}
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden animate-entry delay-200">
        <TitleBar api={api} />
        
        <div className="flex-1 flex flex-row overflow-hidden relative">
          <div className="animate-entry delay-300 h-full flex">
            <Sidebar
              projects={projects}
              openTabs={openTabs}
              activeTabId={activeTabId}
              lastFocusedTabId={lastFocusedTabId}
              onAddProject={handleAddProject}
              onAddProjectsFromParent={handleAddProjectsFromParent}
              onRemoveProject={removeProject}
              onOpenSession={handleOpenSession}
              onSwitchToTab={setActiveTab}
              onOpenSettings={openSettings}
              onOpenProjectWizard={openProjectWizard}
              onUpdateProject={updateProject}
              onCloseProjectTabs={handleCloseProjectTabs}
              width={sidebarWidth}
              collapsed={sidebarCollapsed}
              onWidthChange={setSidebarWidth}
              onCollapsedChange={setSidebarCollapsed}
              isMobileOpen={mobileDrawerOpen}
              onMobileClose={closeMobileDrawer}
              onDisconnect={onDisconnect}
              activeSection={activeSection}
              api={api}
            />
          </div>

          {/* Mobile: render each terminal as its own slide */}
          {isMobile && openTabs.map((tab) => (
            <div key={tab.id} className="mobile-terminal-slide">
              <div className="mobile-slide-header">
                <span className="mobile-slide-title">{tab.title}</span>
                <button className="mobile-slide-close" onClick={() => handleCloseTab(tab.id)}>×</button>
              </div>
              <div className="mobile-slide-content">
                <ErrorBoundary componentName={`Terminal (${tab.title || tab.id})`}>
                  <Terminal
                    ptyId={tab.id}
                    isActive={true}
                    theme={currentTheme}
                    onFocus={() => setLastFocusedTabId(tab.id)}
                    projectPath={tab.projectPath}
                    backend={tab.backend}
                    api={api}
                    isMobile={true}
                    onOpenFileBrowser={() => handleOpenFileBrowser(tab.projectPath || undefined)}
                  />
                </ErrorBoundary>
              </div>
            </div>
          ))}

          {/* Desktop: wrap terminals in main-content */}
          {!isMobile && (
            <>
              <div className="flex-1 flex flex-col min-w-0 bg-background/50 overflow-hidden animate-entry delay-400">
                {claudeInstalled === false || gitBashInstalled === false ? (
                  <InstallationPrompt
                    claudeInstalled={claudeInstalled}
                    npmInstalled={npmInstalled}
                    gitBashInstalled={gitBashInstalled}
                    installing={installing}
                    installError={installError}
                    installMessage={installMessage}
                    onInstallNode={handleInstallNode}
                    onInstallGit={handleInstallGit}
                    onInstallClaude={handleInstallClaude}
                  />
                ) : openTabs.length > 0 ? (
                  <>
                    <Header
                      activeTab={activeTab}
                      openTabs={openTabs}
                      viewMode={viewMode}
                      onToggleViewMode={toggleViewMode}
                      onNewSession={handleNewSessionFromHeader}
                      onSwitchToTab={setActiveTab}
                      onCloseTab={handleCloseTab}
                      onToggleIntelligence={() => setIntelligenceCollapsed(!intelligenceCollapsed)}
                      intelligenceCollapsed={intelligenceCollapsed}
                      api={api}
                    />
                    {viewMode === 'tabs' ? (
                      <div className="flex-1 relative overflow-hidden" ref={terminalContainerRef}>
                        {openTabs.map((tab) => (
                          <div
                            key={tab.id}
                            className={cn(
                              "absolute inset-0 transition-opacity duration-200 pointer-events-none opacity-0",
                              tab.id === activeTabId && "opacity-100 pointer-events-auto"
                            )}
                          >
                            <ErrorBoundary componentName={`Terminal (${tab.title || tab.id})`}>
                              <Terminal
                                ptyId={tab.id}
                                onTerminalTitle={(title) => updateTabTitle(tab.id, title)}
                                onTerminalPath={(path) => updateTabPath(tab.id, path)}
                                onProcessId={(pid) => updateTabPid(tab.id, pid)}
                                onSessionEnded={() => handleTerminalExit(tab.id)}
                                active={tab.id === activeTabId}
                                terminalSettings={settings.terminal}
                                api={api}
                              />
                            </ErrorBoundary>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex-1 overflow-hidden">
                        <TiledTerminalView
                          tabs={openTabs}
                          activeTabId={activeTabId}
                          onSetActiveTab={setActiveTab}
                          onCloseTab={handleCloseTab}
                          onUpdateTabTitle={updateTabTitle}
                          onUpdateTabPath={updateTabPath}
                          onUpdateTabPid={updateTabPid}
                          onTerminalExit={handleTerminalExit}
                          terminalSettings={settings.terminal}
                          api={api}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
                    <div className="w-20 h-20 mb-6 rounded-3xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shadow-inner">
                      <MessageSquare size={40} strokeWidth={1.5} />
                    </div>
                    <h2 className="text-2xl font-bold mb-2 text-white/90">No Active Threads</h2>
                    <p className="text-muted-foreground max-w-sm">
                      Add a project from the workspace, then click a session to open a thread.
                    </p>
                  </div>
                )}
              </div>
              {/* Right Sidebar: Intelligence */}
              {!intelligenceCollapsed && (
                <IntelligenceSidebar
                  intelligence={intelligence}
                  loading={intelligenceLoading}
                  onClose={() => setIntelligenceCollapsed(true)}
                  onRefresh={refreshIntelligence}
                  onWidthChange={setIntelligenceWidth}
                  width={intelligenceWidth}
                />
              )}
            </>
          )}
        </div>
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={closeSettings}
        onThemeChange={setCurrentTheme}
        onSaved={(newSettings) => setSettings(newSettings)}
        appVersion={appVersion}
        updateStatus={updateStatus}
        onDownloadUpdate={downloadUpdate}
        onInstallUpdate={installUpdate}
        projectPath={activeTab?.projectPath || null}
        focusedTabPtyId={activeTabId}
        onOpenSession={handleOpenSession}
        initialCategory={settingsCategory}
        api={api}
      />

        <ProjectInitializationWizard
          isOpen={projectWizardOpen}
          onClose={closeProjectWizard}
          onProjectCreated={handleProjectCreated}
          api={api}
        />

        <Spotlight 
          isOpen={spotlightOpen}
          onClose={() => setSpotlightOpen(false)}
          projects={projects}
          openTabs={openTabs}
          onOpenSession={handleOpenSession}
          onOpenSettings={openSettings}
          onOpenProjectWizard={openProjectWizard}
          onSwitchToTab={setActiveTab}
        />
        <TranscriptionOverlay />
      </div>
    </div>
  )
}
