import {
  Activity,
  ChevronRight,
  Cpu,
  LayoutGrid,
  MessageSquare,
  Settings,
  Terminal,
  Zap,
} from 'lucide-react';
import type React from 'react';
import type { Api, ApprovalRequest, ExtendedApi } from '../../api/types.js';
import { cn } from '../../lib/utils';
import { ActivityFeed } from '../ActivityFeed';
import { AgentBoard } from '../AgentBoard';
import { BeadsPanel } from '../BeadsPanel.js';
import { GSDPlanner } from '../GSDPlanner.js';
import { GSDStatus } from '../GSDStatus.js';
import { ToolCatalog } from '../gsd/ToolCatalog';
import { HealthDashboard } from '../HealthDashboard';
import { JobMonitor } from '../JobMonitor';
import { McpPanel } from '../McpPanel.js';
import { ApprovalWorkflow } from '../orchestration/ApprovalWorkflow.js';
import { SwarmActivityStream } from '../orchestration/SwarmActivityStream';
import { TaskAssignmentView } from '../orchestration/TaskAssignmentView.js';
import { TokenBurnHistory } from '../orchestration/TokenBurnHistory.js';
import type { OpenTab, SidebarProps } from './types.js';

interface SharedProjectProps {
  api: Api;
  beadsProjectPath: string | null;
  focusedTabPtyId: string | null;
  onOpenSession: SidebarProps['onOpenSession'];
}

function sendCommand(
  api: Api,
  focusedTabPtyId: string | null | undefined,
  command: string
): void {
  if (!focusedTabPtyId) return;
  api.writePty(focusedTabPtyId, command);
  setTimeout(() => api.writePty(focusedTabPtyId, '\r'), 100);
}

function startBeadsTask(props: SharedProjectProps, prompt: string): void {
  if (props.beadsProjectPath) {
    props.onOpenSession(
      props.beadsProjectPath,
      undefined,
      undefined,
      prompt,
      true
    );
  }
}

function sendBeadsTask(props: SharedProjectProps, prompt: string): void {
  sendCommand(props.api, props.focusedTabPtyId, prompt);
}

interface ConfigSectionProps extends SharedProjectProps {
  appVersion?: string | null;
  onOpenSettings: SidebarProps['onOpenSettings'];
}

export function ConfigSection(props: ConfigSectionProps): React.ReactElement {
  return (
    <div className="flex flex-col h-full glass-sidebar animate-in slide-in-from-left duration-200">
      <div className="p-4 border-b border-white/5 font-bold flex items-center justify-between bg-white/5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Settings size={18} className="text-primary" />
          <span className="tracking-tight">Configuration</span>
        </div>
        <div className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider">
          {props.appVersion || 'v0.1.0'}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-3">
          <h4 className="px-1 text-xs font-bold uppercase text-muted-foreground tracking-widest">
            Global Settings
          </h4>
          <button
            type="button"
            onClick={props.onOpenSettings}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 hover:border-white/10 group active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-lg shadow-primary/5">
                <LayoutGrid size={18} />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-sm font-semibold">
                  Appearance & Backend
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Themes, Layouts, Backend APIs
                </span>
              </div>
            </div>
            <ChevronRight
              size={14}
              className="text-muted-foreground group-hover:translate-x-1 transition-transform"
            />
          </button>
        </div>

        <div className="space-y-3 pt-4 border-t border-white/5">
          <h4 className="px-1 text-xs font-bold uppercase text-muted-foreground tracking-widest">
            Agents & Tracking
          </h4>
          <div className="p-1 rounded-xl bg-muted/10 border border-white/5">
            <BeadsPanel
              projectPath={props.beadsProjectPath}
              isExpanded={true}
              onToggle={() => {}}
              onStartTaskInNewTab={(prompt) => startBeadsTask(props, prompt)}
              onSendToCurrentTab={(prompt) => sendBeadsTask(props, prompt)}
              currentTabPtyId={props.focusedTabPtyId}
            />
          </div>
          <GSDStatus
            projectPath={props.beadsProjectPath}
            onCommand={(cmd) =>
              sendCommand(props.api, props.focusedTabPtyId, cmd)
            }
          />
        </div>

        <div className="pt-4 border-t border-white/5">
          <McpPanel projectPath={props.beadsProjectPath} api={props.api} />
        </div>
      </div>
    </div>
  );
}

interface TerminalSectionProps {
  openTabs: OpenTab[];
  onSwitchToTab: (tabId: string) => void;
}

export function TerminalSection({
  openTabs,
  onSwitchToTab,
}: TerminalSectionProps): React.ReactElement {
  return (
    <div className="flex flex-col h-full glass-sidebar animate-in slide-in-from-left duration-200">
      <div className="p-4 border-b border-white/5 font-bold flex items-center gap-2 bg-white/5 backdrop-blur-md">
        <MessageSquare size={18} className="text-primary" />
        <span className="tracking-tight text-white/90">Threads</span>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {openTabs.length > 0 ? (
          openTabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => onSwitchToTab(tab.id)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border border-transparent group',
                'hover:bg-white/5 backdrop-blur-md hover:border-white/10'
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Terminal size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">
                  {tab.title}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {tab.backend || 'Claude'}
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4 text-muted-foreground/30">
              <Terminal size={24} />
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              No active sessions
            </p>
            <p className="text-xs text-muted-foreground/50 mt-1">
              Open a project to start an agent session.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function GsdSection({
  api,
  beadsProjectPath,
}: Pick<SharedProjectProps, 'api' | 'beadsProjectPath'>): React.ReactElement {
  return (
    <div className="flex flex-col h-full glass-sidebar animate-in slide-in-from-left duration-200">
      <GSDPlanner projectPath={beadsProjectPath} api={api} />
    </div>
  );
}

interface OrchestrationSectionProps extends SharedProjectProps {
  approvalRequests: ApprovalRequest[];
  respondToApproval: (
    request: ApprovalRequest,
    decision: 'approved' | 'rejected' | 'modified',
    note: string,
    conditions?: string[]
  ) => Promise<void>;
}

export function OrchestrationSection(
  props: OrchestrationSectionProps
): React.ReactElement {
  return (
    <div className="flex flex-col h-full glass-sidebar animate-in slide-in-from-left duration-200">
      <div className="p-4 border-b border-white/5 font-bold flex items-center gap-2 bg-white/5 backdrop-blur-md">
        <Zap size={18} className="text-primary" />
        <span className="tracking-tight text-white/90">Automations</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-3">
          <h4 className="px-1 text-xs font-bold uppercase text-muted-foreground tracking-widest">
            GSD Task Status
          </h4>
          <div className="p-1 rounded-xl bg-white/5 backdrop-blur-md border border-white/5">
            <GSDStatus
              projectPath={props.beadsProjectPath}
              onCommand={(cmd) =>
                sendCommand(props.api, props.focusedTabPtyId, cmd)
              }
            />
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t border-white/5">
          <h4 className="px-1 text-xs font-bold uppercase text-muted-foreground tracking-widest">
            Active Beads
          </h4>
          <div className="p-1 rounded-xl bg-white/5 backdrop-blur-md border border-white/5">
            <BeadsPanel
              projectPath={props.beadsProjectPath}
              isExpanded={true}
              onToggle={() => {}}
              onStartTaskInNewTab={(prompt) => startBeadsTask(props, prompt)}
              onSendToCurrentTab={(prompt) => sendBeadsTask(props, prompt)}
              currentTabPtyId={props.focusedTabPtyId}
            />
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t border-white/5">
          <h4 className="px-1 text-xs font-bold uppercase text-muted-foreground tracking-widest">
            Token Burn History
          </h4>
          <div className="p-2 rounded-xl bg-white/5 backdrop-blur-md border border-white/5">
            <TokenBurnHistory api={props.api} />
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t border-white/5">
          <h4 className="px-1 text-xs font-bold uppercase text-muted-foreground tracking-widest">
            Agent Assignments
          </h4>
          <div className="p-2 rounded-xl bg-white/5 backdrop-blur-md border border-white/5">
            <TaskAssignmentView
              onOpenSession={
                props.beadsProjectPath
                  ? () => props.onOpenSession(props.beadsProjectPath as string)
                  : undefined
              }
            />
          </div>
        </div>

        <div className="space-y-3 pt-4 border-t border-white/5">
          <h4 className="px-1 text-xs font-bold uppercase text-muted-foreground tracking-widest">
            Approval Workflow
          </h4>
          <div className="h-[520px] p-2 rounded-xl bg-white/5 backdrop-blur-md border border-white/5 overflow-hidden">
            <ApprovalWorkflow
              requests={props.approvalRequests}
              onApprove={(request, note) =>
                props.respondToApproval(request, 'approved', note)
              }
              onReject={(request, note) =>
                props.respondToApproval(request, 'rejected', note)
              }
              onRequestChanges={(request, note, conditions) =>
                props.respondToApproval(request, 'modified', note, conditions)
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface ObservabilitySectionProps {
  api: Api;
  focusedProjectPath?: string | null;
}

export function ObservabilitySection({
  api,
  focusedProjectPath,
}: ObservabilitySectionProps): React.ReactElement {
  return (
    <div className="flex flex-col h-full glass-sidebar animate-in slide-in-from-left duration-200">
      <div className="p-4 border-b border-white/5 font-bold flex items-center gap-2 bg-white/5 backdrop-blur-md">
        <Activity size={18} className="text-primary" />
        <span className="tracking-tight text-white/90">Observability</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        <section className="space-y-3">
          <h4 className="px-1 text-xs font-bold uppercase text-muted-foreground tracking-widest">
            App & Plugin Health
          </h4>
          <div className="p-1 rounded-xl bg-white/5 backdrop-blur-md border border-white/5 overflow-hidden">
            <HealthDashboard />
          </div>
        </section>
        <section className="space-y-3 pt-4 border-t border-white/5">
          <h4 className="px-1 text-xs font-bold uppercase text-muted-foreground tracking-widest">
            Agent Board
          </h4>
          <div className="p-1 rounded-xl bg-white/5 backdrop-blur-md border border-white/5 overflow-hidden">
            <AgentBoard />
          </div>
        </section>
        <section className="space-y-3 pt-4 border-t border-white/5 h-[300px] flex flex-col">
          <h4 className="px-1 text-xs font-bold uppercase text-muted-foreground tracking-widest">
            Swarm Stream
          </h4>
          <div className="flex-1 p-1 rounded-xl bg-white/5 backdrop-blur-md border border-white/5 overflow-hidden">
            <SwarmActivityStream
              api={api as ExtendedApi}
              projectPath={focusedProjectPath || ''}
            />
          </div>
        </section>
        <section className="space-y-3 pt-4 border-t border-white/5">
          <h4 className="px-1 text-xs font-bold uppercase text-muted-foreground tracking-widest">
            Job Monitor
          </h4>
          <div className="p-0 rounded-xl overflow-hidden">
            <JobMonitor />
          </div>
        </section>
        <section className="space-y-3 pt-4 border-t border-white/5 h-[400px] flex flex-col">
          <h4 className="px-1 text-xs font-bold uppercase text-muted-foreground tracking-widest">
            Activity Feed
          </h4>
          <div className="flex-1 rounded-xl bg-white/5 backdrop-blur-md border border-white/5 overflow-hidden">
            <ActivityFeed />
          </div>
        </section>
      </div>
    </div>
  );
}

export function PluginsSection(): React.ReactElement {
  return (
    <div className="flex flex-col h-full glass-sidebar animate-in slide-in-from-left duration-200">
      <div className="p-4 border-b border-white/5 font-semibold flex items-center gap-2 bg-white/5 backdrop-blur-md">
        <Cpu size={18} />
        Tools & Capabilities
      </div>
      <div className="flex-1 overflow-hidden p-2">
        <ToolCatalog />
      </div>
    </div>
  );
}

interface HelpSectionProps {
  updateStatus: { status: string; version?: string; error?: string };
  checkForUpdate: () => void;
  downloadUpdate: () => void;
  installUpdate: () => void;
}

export function HelpSection({
  updateStatus,
  checkForUpdate,
  downloadUpdate,
  installUpdate,
}: HelpSectionProps): React.ReactElement {
  return (
    <div className="flex flex-col h-full glass-sidebar animate-in slide-in-from-left duration-200">
      <div className="p-4 border-b border-white/5 font-semibold flex items-center gap-2 bg-white/5 backdrop-blur-md">
        <Settings size={18} />
        Help & Support
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-3">
          <h4 className="px-1 text-xs font-bold uppercase text-muted-foreground tracking-widest">
            Resources
          </h4>
          <button
            type="button"
            onClick={() => checkForUpdate()}
            disabled={updateStatus.status === 'checking'}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 hover:border-white/10 group disabled:opacity-50"
          >
            <span className="text-sm">Check for Updates</span>
            {updateStatus.status === 'checking' ? (
              <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            ) : (
              <ChevronRight
                size={14}
                className="text-muted-foreground group-hover:translate-x-1 transition-transform"
              />
            )}
          </button>
          <a
            href="https://github.com/bobcat88/simple-code-gui/wiki"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 hover:border-white/10 group"
          >
            <span className="text-sm">Documentation</span>
            <ChevronRight
              size={14}
              className="text-muted-foreground group-hover:translate-x-1 transition-transform"
            />
          </a>
          <a
            href="https://github.com/bobcat88/simple-code-gui"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 hover:border-white/10 group"
          >
            <span className="text-sm">GitHub Repository</span>
            <ChevronRight
              size={14}
              className="text-muted-foreground group-hover:translate-x-1 transition-transform"
            />
          </a>
        </div>

        {updateStatus.status !== 'idle' &&
          updateStatus.status !== 'checking' && (
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5 animate-in fade-in zoom-in duration-300">
              <div className="text-sm font-bold text-primary mb-1">
                {updateStatus.status === 'available'
                  ? 'Update Available'
                  : updateStatus.status === 'downloading'
                    ? 'Downloading...'
                    : updateStatus.status === 'downloaded'
                      ? 'Ready to Install'
                      : 'Update Error'}
              </div>
              <div className="text-xs text-muted-foreground mb-3 leading-relaxed">
                {updateStatus.status === 'available'
                  ? `Version ${updateStatus.version} is now available.`
                  : updateStatus.status === 'downloading'
                    ? 'Fetching update files...'
                    : updateStatus.status === 'downloaded'
                      ? 'Restart the application to apply the update.'
                      : updateStatus.error || 'An unexpected error occurred.'}
              </div>

              {updateStatus.status === 'available' && (
                <button
                  type="button"
                  onClick={() => downloadUpdate()}
                  className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md shadow-primary/20"
                >
                  Download Now
                </button>
              )}

              {updateStatus.status === 'downloaded' && (
                <button
                  type="button"
                  onClick={() => installUpdate()}
                  className="w-full py-2.5 rounded-lg bg-green-500 text-white text-[10px] font-bold uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md shadow-green-500/20"
                >
                  Restart & Install
                </button>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
