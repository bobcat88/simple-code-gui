import { MessageSquare } from 'lucide-react';
import type React from 'react';
import type { RefObject } from 'react';
import type { Api, OpenTab } from '../api';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { Header } from '../components/Header';
import { IntelligenceSidebar } from '../components/intelligence/IntelligenceSidebar';
import { OrchestrationPanel } from '../components/orchestration/OrchestrationPanel';
import { Sidebar } from '../components/Sidebar';
import { Terminal } from '../components/terminal/Terminal';
import { TiledTerminalView } from '../components/tiled/index.js';
import { cn } from '../lib/utils';
import { InstallationPrompt } from './InstallationPrompt';

type TerminalTheme = React.ComponentProps<typeof Terminal>['theme'];
type TerminalSettings = React.ComponentProps<
  typeof Terminal
>['terminalSettings'];
type InstallationPromptProps = React.ComponentProps<typeof InstallationPrompt>;
type SidebarProps = React.ComponentProps<typeof Sidebar>;
type TiledTerminalViewProps = React.ComponentProps<typeof TiledTerminalView>;
type IntelligenceSidebarProps = React.ComponentProps<
  typeof IntelligenceSidebar
>;

export function SidebarLayout(props: SidebarProps): React.ReactElement {
  return (
    <div className="animate-entry delay-300 h-full flex">
      <Sidebar {...props} />
    </div>
  );
}

interface MobileLayoutProps {
  openTabs: OpenTab[];
  currentTheme: TerminalTheme;
  api: Api;
  onCloseTab: (id: string) => void;
  onFocusTab: (id: string) => void;
  onOpenFileBrowser: (projectPath?: string) => void;
}

export function MobileLayout({
  openTabs,
  currentTheme,
  api,
  onCloseTab,
  onFocusTab,
  onOpenFileBrowser,
}: MobileLayoutProps): React.ReactElement {
  return (
    <>
      {openTabs.map((tab) => (
        <div className="mobile-terminal-slide" key={tab.id}>
          <div className="mobile-slide-header">
            <span className="mobile-slide-title">{tab.title}</span>
            <button
              className="mobile-slide-close"
              onClick={() => onCloseTab(tab.id)}
              type="button"
            >
              ×
            </button>
          </div>
          <div className="mobile-slide-content">
            <ErrorBoundary componentName={`Terminal (${tab.title || tab.id})`}>
              <Terminal
                api={api}
                backend={tab.backend}
                isActive={true}
                isMobile={true}
                onFocus={() => onFocusTab(tab.id)}
                onOpenFileBrowser={() =>
                  onOpenFileBrowser(tab.projectPath || undefined)
                }
                projectPath={tab.projectPath}
                ptyId={tab.id}
                theme={currentTheme}
              />
            </ErrorBoundary>
          </div>
        </div>
      ))}
    </>
  );
}

interface TerminalLayoutProps {
  activeTab: OpenTab | null;
  activeTabId: string | null;
  api: Api;
  claudeInstalled: boolean | null;
  currentTheme: TerminalTheme;
  gitBashInstalled: boolean | null;
  installError: InstallationPromptProps['installError'];
  installMessage: InstallationPromptProps['installMessage'];
  installing: InstallationPromptProps['installing'];
  intelligenceCollapsed: boolean;
  npmInstalled: boolean | null;
  openTabs: OpenTab[];
  projects: TiledTerminalViewProps['projects'];
  settingsTerminal?: TerminalSettings;
  swipeContainerRef: RefObject<HTMLElement | null>;
  terminalContainerRef: RefObject<HTMLDivElement | null>;
  tileTree: TiledTerminalViewProps['tileTree'];
  viewMode: 'tabs' | 'tiled';
  onCloseTab: (id: string) => void;
  onFocusTab: (id: string) => void;
  onInstallClaude: () => void;
  onInstallGit: () => void;
  onInstallNode: () => void;
  onNewSession: () => void;
  onOpenSidebar: () => void;
  onRenameTab: (id: string, title: string) => void;
  onSetActiveTab: (id: string) => void;
  onTerminalExit: (id: string) => void;
  onToggleIntelligence: () => void;
  onToggleOrchestration: () => void;
  onToggleViewMode: () => void;
  onTreeChange: TiledTerminalViewProps['onTreeChange'];
  onUpdateTabPath: (id: string, path: string) => void;
  onUpdateTabPid: (id: string, pid: string) => void;
  onUpdateTabTitle: (id: string, title: string) => void;
  orchestrationOpen: boolean;
}

export function TerminalLayout({
  activeTab,
  activeTabId,
  api,
  claudeInstalled,
  currentTheme,
  gitBashInstalled,
  installError,
  installMessage,
  installing,
  intelligenceCollapsed,
  npmInstalled,
  openTabs,
  projects,
  settingsTerminal,
  swipeContainerRef,
  terminalContainerRef,
  tileTree,
  viewMode,
  onCloseTab,
  onFocusTab,
  onInstallClaude,
  onInstallGit,
  onInstallNode,
  onNewSession,
  onOpenSidebar,
  onRenameTab,
  onSetActiveTab,
  onTerminalExit,
  onToggleIntelligence,
  onToggleOrchestration,
  onToggleViewMode,
  onTreeChange,
  onUpdateTabPath,
  onUpdateTabPid,
  onUpdateTabTitle,
  orchestrationOpen,
}: TerminalLayoutProps): React.ReactElement {
  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background/50 overflow-hidden animate-entry delay-400">
      {claudeInstalled === false || gitBashInstalled === false ? (
        <InstallationPrompt
          claudeInstalled={claudeInstalled}
          gitBashInstalled={gitBashInstalled}
          installError={installError}
          installMessage={installMessage}
          installing={installing}
          npmInstalled={npmInstalled}
          onInstallClaude={onInstallClaude}
          onInstallGit={onInstallGit}
          onInstallNode={onInstallNode}
        />
      ) : openTabs.length > 0 ? (
        <>
          <Header
            activeTab={activeTab}
            api={api}
            intelligenceCollapsed={intelligenceCollapsed}
            onCloseTab={onCloseTab}
            onNewSession={onNewSession}
            onOpenSidebar={onOpenSidebar}
            onRenameTab={onRenameTab}
            onSwitchToTab={onSetActiveTab}
            onToggleIntelligence={onToggleIntelligence}
            onToggleViewMode={onToggleViewMode}
            openTabs={openTabs}
            swipeContainerRef={swipeContainerRef}
            viewMode={viewMode}
          />
          <button
            className={`orchestration-toggle-btn ${orchestrationOpen ? 'active' : ''}`}
            onClick={onToggleOrchestration}
            title="Toggle Orchestration Hub"
            type="button"
          >
            🤖
          </button>
          {viewMode === 'tabs' ? (
            <div
              className="flex-1 relative overflow-hidden"
              ref={terminalContainerRef}
            >
              {openTabs.map((tab) => (
                <div
                  className={cn(
                    'absolute inset-0 transition-opacity duration-200 pointer-events-none opacity-0',
                    tab.id === activeTabId && 'opacity-100 pointer-events-auto'
                  )}
                  key={tab.id}
                >
                  <ErrorBoundary
                    componentName={`Terminal (${tab.title || tab.id})`}
                  >
                    <Terminal
                      api={api}
                      isActive={tab.id === activeTabId}
                      onProcessId={(pid: string) => onUpdateTabPid(tab.id, pid)}
                      onSessionEnded={() => onTerminalExit(tab.id)}
                      onTerminalPath={(path: string) =>
                        onUpdateTabPath(tab.id, path)
                      }
                      onTerminalTitle={(title: string) =>
                        onUpdateTabTitle(tab.id, title)
                      }
                      ptyId={tab.id}
                      terminalSettings={settingsTerminal}
                      theme={currentTheme}
                    />
                  </ErrorBoundary>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              <TiledTerminalView
                activeTabId={activeTabId}
                api={api}
                onCloseTab={onCloseTab}
                onFocusTab={onFocusTab}
                onRenameTab={onUpdateTabTitle}
                onSetActiveTab={onSetActiveTab}
                onTerminalExit={onTerminalExit}
                onTreeChange={onTreeChange}
                onUpdateTabPath={onUpdateTabPath}
                onUpdateTabPid={onUpdateTabPid}
                onUpdateTabTitle={onUpdateTabTitle}
                projects={projects}
                tabs={openTabs}
                terminalSettings={settingsTerminal}
                theme={currentTheme}
                tileTree={tileTree}
              />
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
          <div className="w-20 h-20 mb-6 rounded-codex bg-indigo-500/10 flex items-center justify-center text-indigo-400 shadow-inner">
            <MessageSquare size={40} strokeWidth={1.5} />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-white/90">
            No Active Threads
          </h2>
          <p className="text-muted-foreground max-w-sm">
            Add a project from the workspace, then click a session to open a
            thread.
          </p>
        </div>
      )}
    </div>
  );
}

interface IntelligenceLayoutProps extends IntelligenceSidebarProps {
  collapsed: boolean;
  orchestrationOpen: boolean;
}

export function IntelligenceLayout({
  collapsed,
  orchestrationOpen,
  ...sidebarProps
}: IntelligenceLayoutProps): React.ReactElement {
  return (
    <>
      {!collapsed && <IntelligenceSidebar {...sidebarProps} />}
      {orchestrationOpen && (
        <div className="orchestration-sidebar">
          <OrchestrationPanel />
        </div>
      )}
    </>
  );
}
