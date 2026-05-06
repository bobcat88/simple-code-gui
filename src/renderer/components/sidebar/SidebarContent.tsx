import { FolderPlus, FolderSearch, Plus, Zap } from 'lucide-react';
import React from 'react';
import type { Api, ApprovalRequest, ExtendedApi } from '../../api/types.js';
import { useUpdater } from '../../hooks/useUpdater.js';
import type { Project } from '../../stores/workspace.js';
import { ClaudeMdEditor } from '../ClaudeMdEditor.js';
import { ExtensionBrowser } from '../ExtensionBrowser.js';
import { McpBrowser } from '../mcp/McpBrowser.js';
import {
  CategoryContextMenu,
  CategoryHeader,
  DeleteConfirmModal,
  getCategoryGradient,
  ProjectContextMenu,
  ProjectSettingsModal,
  SidebarActions,
  VirtualizedProjectList,
} from './index.js';
import {
  ConfigSection,
  GsdSection,
  HelpSection,
  ObservabilitySection,
  OrchestrationSection,
  PluginsSection,
  TerminalSection,
} from './SidebarSections.js';
import type { OpenTab, SidebarProps } from './types.js';
import type { SidebarHandlers } from './useSidebarHandlers.js';
import type { SidebarState } from './useSidebarState.js';

export interface SidebarContentProps {
  state: SidebarState;
  handlers: SidebarHandlers;
  projects: Project[];
  openTabs: OpenTab[];
  activeSection?: string;
  onOpenSession: SidebarProps['onOpenSession'];
  onRemoveProject: SidebarProps['onRemoveProject'];
  onUpdateProject: SidebarProps['onUpdateProject'];
  onAddProject: SidebarProps['onAddProject'];
  onAddProjectsFromParent: SidebarProps['onAddProjectsFromParent'];
  onOpenProjectWizard: SidebarProps['onOpenProjectWizard'];
  onOpenSettings: SidebarProps['onOpenSettings'];
  api: Api;
  renderProjectItem: (project: Project) => React.ReactElement;
}

function normalizeApprovalRequest(
  raw: ApprovalRequest | Record<string, unknown>
): ApprovalRequest {
  const value = raw as ApprovalRequest & Record<string, unknown>;
  return {
    id: String(value.id ?? ''),
    agentId: String(value.agentId ?? value.agent_id ?? ''),
    agentName: String(value.agentName ?? value.agent_name ?? 'Agent'),
    category: (value.category ?? 'file_change') as ApprovalRequest['category'],
    risk: (value.risk ?? 'medium') as ApprovalRequest['risk'],
    title: String(value.title ?? 'Approval request'),
    description: String(value.description ?? ''),
    fileDiffs: (value.fileDiffs ??
      value.file_diffs) as ApprovalRequest['fileDiffs'],
    command: value.command as string | undefined,
    affectedPaths: (value.affectedPaths ??
      value.affected_paths) as ApprovalRequest['affectedPaths'],
    reversible: Boolean(value.reversible),
    timestamp: Number(value.timestamp ?? Date.now()),
    expiresAt:
      (value.expiresAt ?? value.expires_at)
        ? Number(value.expiresAt ?? value.expires_at)
        : undefined,
  };
}

export function SidebarContent(props: SidebarContentProps): React.ReactElement {
  const {
    state,
    handlers,
    projects,
    openTabs,
    activeSection = 'terminal',
    onOpenSession,
    onRemoveProject,
    onUpdateProject,
    onAddProject,
    onAddProjectsFromParent,
    onOpenProjectWizard,
    onOpenSettings,
    api,
    renderProjectItem,
  } = props;

  const {
    appVersion,
    updateStatus,
    checkForUpdate,
    downloadUpdate,
    installUpdate,
  } = useUpdater();
  const [approvalRequests, setApprovalRequests] = React.useState<
    ApprovalRequest[]
  >([]);

  const {
    // State
    sortedCategories,
    projectsByCategory,
    expandedProject,
    sessions,
    dropTarget,
    draggedCategory,
    draggedProject,
    editingCategory,
    categoryEditInputRef,
    contextMenu,
    setContextMenu,
    categoryContextMenu,
    setCategoryContextMenu,
    deleteConfirmModal,
    setDeleteConfirmModal,
    projectSettingsModal,
    setProjectSettingsModal,
    extensionBrowserModal,
    setExtensionBrowserModal,
    claudeMdEditorModal,
    setClaudeMdEditorModal,
    beadsProjectPath,
    focusedTabPtyId,
    focusedProject,
    focusedProjectPath,
    apiStatus,
    isDebugMode,
    categories,
    addCategory,
    moveProjectToCategory,
    removeCategory,
    globalPermissions,
    globalVoiceSettings,
    installedVoices,
    handleOpenProjectSettings,
    handleSaveProjectSettings,
    handleProjectSettingsChange,
    handleToggleTool,
    handleAllowAll,
    handleClearAll,
    handleToggleApi,
    handleCategoryDragStart,
    handleCategoryDragEnd,
    handleCategoryHeaderDragOver,
    handleCategoryDragOver,
    handleCategoryHeaderDrop,
    handleCategoryDrop,
    setEditingCategory,
    mcpBrowserOpen,
    setMcpBrowserOpen,
  } = state;

  React.useEffect(() => {
    let cancelled = false;

    async function loadApprovals() {
      if (!api.getPendingApprovals || !beadsProjectPath) {
        setApprovalRequests([]);
        return;
      }

      try {
        const pending = await api.getPendingApprovals(beadsProjectPath);
        if (!cancelled) {
          setApprovalRequests(pending.map(normalizeApprovalRequest));
        }
      } catch {
        if (!cancelled) {
          setApprovalRequests([]);
        }
      }
    }

    void loadApprovals();

    const unsubscribeRequest = api.onApprovalRequest?.((request) => {
      const normalized = normalizeApprovalRequest(request);
      setApprovalRequests((current) => [
        normalized,
        ...current.filter((item) => item.id !== normalized.id),
      ]);
    });
    const unsubscribeResolved = api.onApprovalResolved?.((actionId) => {
      setApprovalRequests((current) =>
        current.filter((item) => item.id !== actionId)
      );
    });

    return () => {
      cancelled = true;
      unsubscribeRequest?.();
      unsubscribeResolved?.();
    };
  }, [api, beadsProjectPath]);

  const respondToApproval = React.useCallback(
    async (
      request: ApprovalRequest,
      decision: 'approved' | 'rejected' | 'modified',
      note: string,
      conditions?: string[]
    ) => {
      await api.respondToApproval?.({
        actionId: request.id,
        decision,
        comment: note || undefined,
        conditions,
      });
      setApprovalRequests((current) =>
        current.filter((item) => item.id !== request.id)
      );
    },
    [api]
  );

  const {
    handleAddCategory,
    handleOpenAllProjects,
    handleOpenCategoryAsProject,
    handleStartCategoryRename,
    handleCategoryRenameSubmit,
    handleCategoryRenameKeyDown,
    toggleCategoryCollapse,
    handleRunExecutable,
    handleSelectExecutable,
    handleClearExecutable,
  } = handlers;

  if (activeSection === 'config') {
    return (
      <ConfigSection
        api={api}
        appVersion={appVersion}
        beadsProjectPath={beadsProjectPath ?? null}
        focusedTabPtyId={focusedTabPtyId ?? null}
        onOpenSession={onOpenSession}
        onOpenSettings={onOpenSettings}
      />
    );
  } else if (activeSection === 'terminal') {
    return (
      <TerminalSection
        openTabs={openTabs}
        onSwitchToTab={handlers.handleSwitchToTab}
      />
    );
  } else if (activeSection === 'gsd') {
    return <GsdSection beadsProjectPath={beadsProjectPath ?? null} api={api} />;
  } else if (activeSection === 'orchestration') {
    return (
      <OrchestrationSection
        api={api}
        beadsProjectPath={beadsProjectPath ?? null}
        focusedTabPtyId={focusedTabPtyId ?? null}
        onOpenSession={onOpenSession}
        approvalRequests={approvalRequests}
        respondToApproval={respondToApproval}
      />
    );
  } else if (activeSection === 'observability') {
    return (
      <ObservabilitySection api={api} focusedProjectPath={focusedProjectPath} />
    );
  } else if (activeSection === 'plugins') {
    return <PluginsSection />;
  } else if (activeSection === 'help') {
    return (
      <HelpSection
        updateStatus={updateStatus}
        checkForUpdate={checkForUpdate}
        downloadUpdate={downloadUpdate}
        installUpdate={installUpdate}
      />
    );
  }

  return (
    <div className="flex flex-col h-full glass-sidebar animate-in slide-in-from-left duration-200">
      <div className="p-4 flex items-center justify-between border-b border-white/5 bg-white/5 backdrop-blur-md">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/70">
          Projects
        </h2>
        <button
          type="button"
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
          onClick={handleAddCategory}
          title="Add category"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {/* All Projects meta-entry at top */}
        <button
          type="button"
          className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20"
          onClick={handleOpenAllProjects}
        >
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <Zap size={18} fill="currentColor" />
          </div>
          <span className="font-semibold text-sm text-foreground/80 group-hover:text-primary transition-colors">
            All Projects
          </span>
        </button>

        {sortedCategories.map((category) => {
          const categoryProjects = projectsByCategory[category.id] || [];
          const { background: gradient, textDark } =
            getCategoryGradient(categoryProjects);

          return (
            <div
              key={category.id}
              className={`category-container ${dropTarget?.type === 'category' && dropTarget.id === category.id && !dropTarget.position ? 'drop-target' : ''}`}
            >
              {dropTarget?.type === 'category' &&
                dropTarget.id === category.id &&
                dropTarget.position === 'before' && (
                  <div className="drop-indicator" />
                )}

              <CategoryHeader
                category={category}
                projectCount={categoryProjects.length}
                gradient={gradient}
                textDark={textDark}
                isCollapsed={category.collapsed || false}
                isDragging={draggedCategory === category.id}
                isEditing={editingCategory?.id === category.id}
                editingName={
                  editingCategory?.id === category.id
                    ? editingCategory.name
                    : ''
                }
                editInputRef={categoryEditInputRef}
                draggedCategory={draggedCategory}
                draggedProject={draggedProject}
                onToggleCollapse={() => toggleCategoryCollapse(category.id)}
                onOpenAsProject={() =>
                  handleOpenCategoryAsProject(category.name)
                }
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setCategoryContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    category,
                  });
                }}
                onDragStart={(e) => handleCategoryDragStart(e, category.id)}
                onDragEnd={handleCategoryDragEnd}
                onCategoryHeaderDragOver={(e, position) =>
                  handleCategoryHeaderDragOver(e, category.id, position)
                }
                onCategoryDragOver={(e) =>
                  handleCategoryDragOver(e, category.id)
                }
                onCategoryHeaderDrop={(e) =>
                  handleCategoryHeaderDrop(e, category.id)
                }
                onCategoryDrop={(e) => handleCategoryDrop(e, category.id)}
                onStartRename={() => handleStartCategoryRename(category)}
                onEditingChange={(name) =>
                  setEditingCategory({ id: category.id, name })
                }
                onRenameSubmit={handleCategoryRenameSubmit}
                onRenameKeyDown={handleCategoryRenameKeyDown}
              />

              {dropTarget?.type === 'category' &&
                dropTarget.id === category.id &&
                dropTarget.position === 'after' && (
                  <div className="drop-indicator" />
                )}

              {!category.collapsed && (
                <div className="category-projects">
                  <VirtualizedProjectList
                    projects={categoryProjects}
                    expandedProject={expandedProject}
                    sessions={sessions}
                    renderItem={renderProjectItem}
                  />
                </div>
              )}
            </div>
          );
        })}

        {(projectsByCategory.uncategorized?.length > 0 ||
          sortedCategories.length > 0) && (
          <fieldset
            className={`uncategorized-section ${dropTarget?.type === 'uncategorized' ? 'drop-target' : ''}`}
            onDragOver={(e) => handleCategoryDragOver(e, null)}
            onDrop={(e) => handleCategoryDrop(e, null)}
          >
            {sortedCategories.length > 0 &&
              projectsByCategory.uncategorized?.length > 0 && (
                <div className="uncategorized-header">Uncategorized</div>
              )}
            {projectsByCategory.uncategorized && (
              <VirtualizedProjectList
                projects={projectsByCategory.uncategorized}
                expandedProject={expandedProject}
                sessions={sessions}
                renderItem={renderProjectItem}
              />
            )}
          </fieldset>
        )}

        {projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4 text-muted-foreground/30">
              <FolderPlus size={24} />
            </div>
            <p className="text-sm text-muted-foreground">No projects yet.</p>
            <p className="text-xs text-muted-foreground/50 mt-1">
              Add one to get started.
            </p>
          </div>
        )}
      </div>

      <div className="p-3 grid grid-cols-3 gap-2 border-t border-white/5 backdrop-blur-md">
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-muted/30 hover:bg-primary/10 hover:text-primary transition-all border border-transparent hover:border-primary/20 group"
          onClick={onOpenProjectWizard}
          title="Create new project from scratch"
        >
          <Plus
            size={16}
            className="group-hover:scale-125 transition-transform"
          />
          <span className="text-[10px] font-bold uppercase tracking-tighter">
            Make
          </span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-muted/30 hover:bg-primary/10 hover:text-primary transition-all border border-transparent hover:border-primary/20 group"
          onClick={onAddProject}
          title="Add existing project folder"
        >
          <FolderPlus
            size={16}
            className="group-hover:scale-125 transition-transform"
          />
          <span className="text-[10px] font-bold uppercase tracking-tighter">
            Add
          </span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-muted/30 hover:bg-primary/10 hover:text-primary transition-all border border-transparent hover:border-primary/20 group"
          onClick={onAddProjectsFromParent}
          title="Add all projects from a parent folder"
        >
          <FolderSearch
            size={16}
            className="group-hover:scale-125 transition-transform"
          />
          <span className="text-[10px] font-bold uppercase tracking-tighter">
            Scan
          </span>
        </button>
      </div>

      <SidebarActions
        focusedProject={focusedProject}
        apiStatus={
          focusedProjectPath ? apiStatus[focusedProjectPath] : undefined
        }
        isDebugMode={isDebugMode}
        api={api as ExtendedApi}
        onOpenProjectSettings={async (project) => {
          await handleOpenProjectSettings(project);
          setContextMenu(null);
        }}
        onToggleApi={async (project) => {
          await handleToggleApi(project);
          setContextMenu(null);
        }}
      />

      {/* Context Menu */}
      {contextMenu && (
        <ProjectContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          project={contextMenu.project}
          categories={categories}
          onClose={() => setContextMenu(null)}
          onRunExecutable={() => handleRunExecutable(contextMenu.project)}
          onSelectExecutable={() => handleSelectExecutable(contextMenu.project)}
          onClearExecutable={() => handleClearExecutable(contextMenu.project)}
          onOpenSettings={async () => {
            await handleOpenProjectSettings(contextMenu.project);
            setContextMenu(null);
          }}
          onOpenExtensions={() => {
            setExtensionBrowserModal({ project: contextMenu.project });
            setContextMenu(null);
          }}
          onEditClaudeMd={() => {
            setClaudeMdEditorModal({ project: contextMenu.project });
            setContextMenu(null);
          }}
          onUpdateColor={(color) =>
            onUpdateProject(contextMenu.project.path, { color })
          }
          onMoveToCategory={(categoryId) =>
            moveProjectToCategory(contextMenu.project.path, categoryId)
          }
          onCreateCategory={() => {
            const newId = addCategory('New Category');
            moveProjectToCategory(contextMenu.project.path, newId);
            setContextMenu(null);
            setEditingCategory({ id: newId, name: 'New Category' });
            setTimeout(() => categoryEditInputRef.current?.select(), 0);
          }}
          onDelete={() => {
            setDeleteConfirmModal({ project: contextMenu.project });
            setContextMenu(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal && (
        <DeleteConfirmModal
          project={deleteConfirmModal.project}
          onClose={() => setDeleteConfirmModal(null)}
          onConfirm={() => {
            onRemoveProject(deleteConfirmModal.project.path);
            setDeleteConfirmModal(null);
          }}
        />
      )}

      {/* Project Settings Modal */}
      {projectSettingsModal && (
        <ProjectSettingsModal
          state={projectSettingsModal}
          globalPermissions={globalPermissions}
          globalVoiceSettings={globalVoiceSettings}
          installedVoices={installedVoices}
          onClose={() => setProjectSettingsModal(null)}
          onSave={handleSaveProjectSettings}
          onChange={handleProjectSettingsChange}
          onToggleTool={handleToggleTool}
          onAllowAll={handleAllowAll}
          onClearAll={handleClearAll}
        />
      )}

      {/* Extension Browser Modal */}
      {extensionBrowserModal && (
        <ExtensionBrowser
          projectPath={extensionBrowserModal.project.path}
          projectName={extensionBrowserModal.project.name}
          onClose={() => setExtensionBrowserModal(null)}
          api={api}
        />
      )}

      {/* CLAUDE.md Editor Modal */}
      {claudeMdEditorModal && (
        <ClaudeMdEditor
          isOpen={true}
          projectPath={claudeMdEditorModal.project.path}
          projectName={claudeMdEditorModal.project.name}
          onClose={() => setClaudeMdEditorModal(null)}
        />
      )}

      {/* Category Context Menu */}
      {categoryContextMenu && (
        <CategoryContextMenu
          x={categoryContextMenu.x}
          y={categoryContextMenu.y}
          category={categoryContextMenu.category}
          onRename={() => {
            handleStartCategoryRename(categoryContextMenu.category);
            setCategoryContextMenu(null);
          }}
          onDelete={() => {
            removeCategory(categoryContextMenu.category.id);
            setCategoryContextMenu(null);
          }}
        />
      )}
      {/* MCP Browser Modal */}
      {mcpBrowserOpen && (
        <McpBrowser onClose={() => setMcpBrowserOpen(false)} />
      )}
    </div>
  );
}
