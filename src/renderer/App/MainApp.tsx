import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Api, ExtendedApi } from '../api';
import { NeuralHUD } from '../components/gsd/NeuralHUD';
import { IconBar } from '../components/IconBar';
import { CognitiveSearchModal } from '../components/intelligence/CognitiveSearchModal';
import { ConsensusOverlay } from '../components/orchestration/ConsensusOverlay';
import { ProjectInitializationWizard } from '../components/ProjectInitializationWizard';
import { SettingsModal } from '../components/SettingsModal';
import { Spotlight } from '../components/Spotlight';
import { TitleBar } from '../components/TitleBar';
import { TranscriptionOverlay } from '../components/voice/TranscriptionOverlay';
import { DialogProvider } from '../contexts/DialogContext';
import { useModals } from '../contexts/ModalContext';
import { useVoice } from '../contexts/VoiceContext';
import {
  useApiListeners,
  useInstallation,
  useJobPolling,
  useProjectHandlers,
  useSessionPolling,
  useUpdater,
  useViewState,
  useWorkspaceLoader,
} from '../hooks';
import { useProjectIntelligence } from '../hooks/useProjectIntelligence';
import { useWorkspaceStore } from '../stores/workspace';
import {
  IntelligenceLayout,
  MobileLayout,
  SidebarLayout,
  TerminalLayout,
} from './MainAppLayouts';

export interface MainAppProps {
  api: Api;
  isElectron: boolean;
  isTauri?: boolean;
  onDisconnect?: () => void;
}

type ProjectAwareApi = Api & {
  setCurrentProject?: (projectPath: string | null) => Promise<void>;
};

export function MainApp({
  api,
  isElectron,
  isTauri,
  onDisconnect,
}: MainAppProps): React.ReactElement {
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
    setActiveTab,
  } = useWorkspaceStore();

  const { voiceOutputEnabled, setProjectVoice } = useVoice();
  const voiceOutputEnabledRef = useRef(voiceOutputEnabled);

  // Modal state from context
  const {
    settingsOpen,
    projectWizardOpen,
    openSettings,
    closeSettings,
    openProjectWizard,
    closeProjectWizard,
  } = useModals();

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
    handleInstallClaude,
  } = useInstallation(api);

  const activeTab = openTabs.find((t) => t.id === activeTabId) || null;
  const extendedApi = api as ExtendedApi;

  const handleNewSessionFromHeader = () => {
    if (activeTab) {
      handleOpenSession(
        activeTab.projectPath,
        undefined,
        undefined,
        undefined,
        true
      );
    } else if (projects.length > 0) {
      handleOpenSession(
        projects[0].path,
        undefined,
        undefined,
        undefined,
        true
      );
    }
  };

  // Updater state from hook
  const { appVersion, updateStatus, downloadUpdate, installUpdate } =
    useUpdater();

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
    toggleViewMode,
  } = useViewState();

  const [cognitiveSearchOpen, setCognitiveSearchOpen] = useState(false);

  const {
    intelligence,
    capabilityScan,
    vectorStatus,
    loading: intelligenceLoading,
    refresh: refreshIntelligence,
    triggerDeepScan,
    syncGlobalKnowledge,
    reindexProject,
  } = useProjectIntelligence(extendedApi, activeTab?.projectPath || null);

  // Workspace loader hook
  const { loading, currentTheme, settings, setCurrentTheme, setSettings } =
    useWorkspaceLoader({
      api,
      checkInstallation,
      setViewMode,
      setTileTree,
    });

  // Session polling hook
  useSessionPolling({ api, openTabs, updateTab });

  // Job polling hook
  useJobPolling(api);

  // API listeners hook
  useApiListeners({
    api,
    projects,
    settings,
    addTab,
    updateTab,
    setActiveTab,
  });

  // Project handlers hook
  const {
    handleAddProject,
    handleAddProjectsFromParent,
    handleOpenSession,
    handleCloseTab,
    handleCloseProjectTabs,
    handleProjectCreated,
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
    setTileTree,
  });

  const handleRenameTab = useCallback(
    (id: string, title: string) => {
      updateTab(id, { title, customTitle: true });
    },
    [updateTab]
  );

  const updateTabTitle = useCallback(
    (id: string, title: string) => {
      updateTab(id, { title });
    },
    [updateTab]
  );

  const updateTabPath = useCallback(
    (id: string, path: string) => {
      updateTab(id, { projectPath: path });
    },
    [updateTab]
  );

  const updateTabPid = useCallback(
    (id: string, ptyId: string) => {
      updateTab(id, { ptyId });
    },
    [updateTab]
  );

  const handleTerminalExit = useCallback(
    (id: string) => {
      removeTab(id);
    },
    [removeTab]
  );

  // App-specific state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [, setShowFileBrowser] = useState(false);
  const [orchestrationOpen, setOrchestrationOpen] = useState(false);
  const [, setFileBrowserPath] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('terminal');
  const [settingsCategory] = useState('general');
  const isMobile = !isElectron;
  const hadProjectsRef = useRef(false);
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const [spotlightOpen, setSpotlightOpen] = useState(false);

  // Spotlight Hotkey (Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSpotlightOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && spotlightOpen) {
        setSpotlightOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [spotlightOpen]);

  // Load MCP config on mount
  useEffect(() => {
    if (isTauri && api.mcpLoadConfig) {
      api.mcpLoadConfig().catch((err) => {
        console.error('Failed to load MCP config:', err);
      });
    }
  }, [api, isTauri]);

  // Keep ref in sync for callbacks
  useEffect(() => {
    voiceOutputEnabledRef.current = voiceOutputEnabled;
  }, [voiceOutputEnabled]);

  // Apply per-project voice settings when active tab changes
  useEffect(() => {
    if (!activeTabId) {
      setProjectVoice(null);
      return;
    }
    const activeTab = openTabs.find((t) => t.id === activeTabId);
    if (!activeTab) {
      setProjectVoice(null);
      return;
    }
    const project = projects.find((p) => p.path === activeTab.projectPath);
    if (project?.ttsVoice && project?.ttsEngine) {
      setProjectVoice({
        ttsVoice: project.ttsVoice,
        ttsEngine: project.ttsEngine,
      });
    } else {
      setProjectVoice(null);
    }
  }, [activeTabId, openTabs, projects, setProjectVoice]);

  // Sync current project with backend for background orchestration
  useEffect(() => {
    const projectAwareApi = api as ProjectAwareApi;
    if (isTauri && projectAwareApi.setCurrentProject) {
      projectAwareApi
        .setCurrentProject(activeTab?.projectPath || null)
        .catch((err: unknown) => {
          console.error('Failed to set current project on backend:', err);
        });
    }
  }, [activeTab?.projectPath, api, isTauri]);

  // Save workspace when it changes
  useEffect(() => {
    if (!loading) {
      const hadProjects =
        sessionStorage.getItem('hadProjects') === 'true' ||
        hadProjectsRef.current;

      if (projects.length === 0 && hadProjects) {
        console.warn(
          'Skipping save: projects empty but previously had projects (likely hot reload)'
        );
        return;
      }

      if (projects.length > 0) {
        hadProjectsRef.current = true;
        sessionStorage.setItem('hadProjects', 'true');
      }

      api.saveWorkspace({
        projects,
        openTabs: openTabs.map((t) => ({
          id: t.id,
          projectPath: t.projectPath,
          sessionId: t.sessionId,
          title: t.title,
          customTitle: t.customTitle || undefined,
          ptyId: t.ptyId,
          backend: t.backend,
        })),
        activeTabId,
        viewMode,
        tileTree: tileTree || undefined,
        categories,
      });
    }
  }, [
    api,
    projects,
    openTabs,
    activeTabId,
    loading,
    viewMode,
    tileTree,
    categories,
  ]);

  // Mobile drawer handlers
  const openMobileDrawer = useCallback(() => {
    setMobileDrawerOpen(true);
  }, []);

  const closeMobileDrawer = useCallback(() => {
    setMobileDrawerOpen(false);
  }, []);

  // Open file browser (mobile only)
  const handleOpenFileBrowser = useCallback((projectPath?: string) => {
    setFileBrowserPath(projectPath || null);
    setShowFileBrowser(true);
  }, []);

  if (loading) {
    return (
      <div className="app">
        <div className="empty-state" role="status" aria-live="polite">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <DialogProvider>
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

            <div className="flex-1 flex flex-row relative">
              <SidebarLayout
                activeSection={activeSection}
                activeTabId={activeTabId}
                api={api}
                collapsed={sidebarCollapsed}
                isMobileOpen={mobileDrawerOpen}
                lastFocusedTabId={lastFocusedTabId}
                onAddProject={handleAddProject}
                onAddProjectsFromParent={handleAddProjectsFromParent}
                onCloseProjectTabs={handleCloseProjectTabs}
                onCollapsedChange={setSidebarCollapsed}
                onDisconnect={onDisconnect}
                onMobileClose={closeMobileDrawer}
                onOpenProjectWizard={openProjectWizard}
                onOpenSession={handleOpenSession}
                onOpenSettings={openSettings}
                onRemoveProject={removeProject}
                onSwitchToTab={setActiveTab}
                onUpdateProject={updateProject}
                onWidthChange={setSidebarWidth}
                openTabs={openTabs}
                projects={projects}
                width={sidebarWidth}
              />

              {isMobile && (
                <MobileLayout
                  api={api}
                  currentTheme={currentTheme}
                  onCloseTab={handleCloseTab}
                  onFocusTab={setLastFocusedTabId}
                  onOpenFileBrowser={handleOpenFileBrowser}
                  openTabs={openTabs}
                />
              )}

              {!isMobile && (
                <>
                  <TerminalLayout
                    activeTab={activeTab}
                    activeTabId={activeTabId}
                    api={api}
                    claudeInstalled={claudeInstalled}
                    currentTheme={currentTheme}
                    gitBashInstalled={gitBashInstalled}
                    installError={installError}
                    installMessage={installMessage}
                    installing={installing}
                    intelligenceCollapsed={intelligenceCollapsed}
                    npmInstalled={npmInstalled}
                    onCloseTab={handleCloseTab}
                    onFocusTab={setActiveTab}
                    onInstallClaude={handleInstallClaude}
                    onInstallGit={handleInstallGit}
                    onInstallNode={handleInstallNode}
                    onNewSession={handleNewSessionFromHeader}
                    onOpenSidebar={openMobileDrawer}
                    onRenameTab={handleRenameTab}
                    onSetActiveTab={setActiveTab}
                    onTerminalExit={handleTerminalExit}
                    onToggleIntelligence={() =>
                      setIntelligenceCollapsed(!intelligenceCollapsed)
                    }
                    onToggleOrchestration={() =>
                      setOrchestrationOpen(!orchestrationOpen)
                    }
                    onToggleViewMode={toggleViewMode}
                    onTreeChange={setTileTree}
                    onUpdateTabPath={updateTabPath}
                    onUpdateTabPid={updateTabPid}
                    onUpdateTabTitle={updateTabTitle}
                    openTabs={openTabs}
                    orchestrationOpen={orchestrationOpen}
                    projects={projects}
                    settingsTerminal={settings?.terminal}
                    swipeContainerRef={terminalContainerRef}
                    terminalContainerRef={terminalContainerRef}
                    tileTree={tileTree}
                    viewMode={viewMode}
                  />
                  <IntelligenceLayout
                    activeTab={activeTab}
                    api={extendedApi}
                    capabilityScan={capabilityScan}
                    collapsed={intelligenceCollapsed}
                    intelligence={intelligence}
                    loading={intelligenceLoading}
                    onClose={() => setIntelligenceCollapsed(true)}
                    onDeepScan={triggerDeepScan}
                    onOpenSearch={() => setCognitiveSearchOpen(true)}
                    onRefresh={refreshIntelligence}
                    onReindex={reindexProject}
                    onSyncMemory={syncGlobalKnowledge}
                    onWidthChange={setIntelligenceWidth}
                    orchestrationOpen={orchestrationOpen}
                    vectorStatus={vectorStatus}
                    width={intelligenceWidth}
                  />
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
            api={extendedApi}
          />
          <TranscriptionOverlay />
          <NeuralHUD />
          <ConsensusOverlay />

          <CognitiveSearchModal
            isOpen={cognitiveSearchOpen}
            onClose={() => setCognitiveSearchOpen(false)}
            api={api}
            projectPath={activeTab?.projectPath || null}
          />
        </div>
      </div>
    </DialogProvider>
  );
}
