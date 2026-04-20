import React from 'react'
import { Project, useWorkspaceStore } from '../../stores/workspace.js'
import { Api } from '../../api/types.js'
import { Settings, LayoutGrid, Terminal, Plus, FolderPlus, FolderSearch, Zap, ChevronRight, Cpu, MessageSquare } from 'lucide-react'
import { cn } from '../../lib/utils'
import { BeadsPanel } from '../BeadsPanel.js'
import { GSDStatus } from '../GSDStatus.js'
import { ExtensionBrowser } from '../ExtensionBrowser.js'
import { ClaudeMdEditor } from '../ClaudeMdEditor.js'
import { McpPanel } from '../McpPanel.js'
import { McpBrowser } from '../mcp/McpBrowser.js'
import {
  getCategoryGradient,
  ProjectItem,
  ProjectContextMenu,
  ProjectSettingsModal,
  CategoryContextMenu,
  DeleteConfirmModal,
  VirtualizedProjectList,
  CategoryHeader,
  VoiceOptionsPanel,
  SidebarActions,
} from './index.js'
import { SidebarState } from './useSidebarState.js'
import { SidebarHandlers } from './useSidebarHandlers.js'
import { SidebarProps, OpenTab } from './types.js'

export interface SidebarContentProps {
  state: SidebarState
  handlers: SidebarHandlers
  projects: Project[]
  openTabs: OpenTab[]
  activeSection?: string
  onOpenSession: SidebarProps['onOpenSession']
  onRemoveProject: SidebarProps['onRemoveProject']
  onUpdateProject: SidebarProps['onUpdateProject']
  onAddProject: SidebarProps['onAddProject']
  onAddProjectsFromParent: SidebarProps['onAddProjectsFromParent']
  onOpenProjectWizard: SidebarProps['onOpenProjectWizard']
  onOpenSettings: SidebarProps['onOpenSettings']
  api: Api
  renderProjectItem: (project: Project) => React.ReactElement
}

import { useUpdater } from '../../hooks/useUpdater.js'

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
  } = props

  const { appVersion, updateStatus, checkForUpdate, downloadUpdate, installUpdate } = useUpdater()

  const {
    // Voice options
    volume,
    setVolume,
    speed,
    setSpeed,
    skipOnNew,
    setSkipOnNew,
    voiceOutputEnabled,

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
    beadsExpanded,
    setBeadsExpanded,
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
  } = state

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
  } = handlers

  if (activeSection === 'config') {
    return (
      <div className="flex flex-col h-full bg-background/80 backdrop-blur-md animate-in slide-in-from-left duration-200">
        <div className="p-4 border-b border-border/50 font-bold flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-primary" />
            <span className="tracking-tight">Configuration</span>
          </div>
          <div className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider">{appVersion || 'v0.1.0'}</div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-3">
            <h4 className="px-1 text-xs font-bold uppercase text-muted-foreground tracking-widest">Global Settings</h4>
            <button 
              onClick={onOpenSettings}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 hover:border-white/10 group active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-lg shadow-primary/5">
                  <LayoutGrid size={18} />
                </div>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold">Appearance & Backend</span>
                  <span className="text-[10px] text-muted-foreground">Themes, Layouts, Backend APIs</span>
                </div>
              </div>
              <ChevronRight size={14} className="text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="space-y-3 pt-4 border-t border-white/5">
            <h4 className="px-1 text-xs font-bold uppercase text-muted-foreground tracking-widest">Agents & Tracking</h4>
            <div className="p-1 rounded-xl bg-muted/10 border border-white/5">
              <BeadsPanel
                projectPath={beadsProjectPath}
                isExpanded={true}
                onToggle={() => {}}
                onStartTaskInNewTab={(prompt) => {
                  if (beadsProjectPath) onOpenSession(beadsProjectPath, undefined, undefined, prompt, true)
                }}
                onSendToCurrentTab={(prompt) => {
                  if (focusedTabPtyId) {
                    api.writePty(focusedTabPtyId, prompt)
                    setTimeout(() => api.writePty(focusedTabPtyId, '\r'), 100)
                  }
                }}
                currentTabPtyId={focusedTabPtyId}
              />
            </div>
            <GSDStatus
              projectPath={beadsProjectPath}
              onCommand={(cmd) => {
                if (focusedTabPtyId) {
                  api.writePty(focusedTabPtyId, cmd)
                  setTimeout(() => api.writePty(focusedTabPtyId, '\r'), 100)
                }
              }}
            />
          </div>

          <div className="pt-4 border-t border-white/5">
            <McpPanel projectPath={beadsProjectPath} />
          </div>
        </div>
      </div>
    )
  } else if (activeSection === 'terminal') {
    return (
      <div className="flex flex-col h-full bg-background/80 backdrop-blur-md animate-in slide-in-from-left duration-200">
        <div className="p-4 border-b border-border/50 font-bold flex items-center gap-2 bg-white/5">
          <MessageSquare size={18} className="text-primary" />
          <span className="tracking-tight text-white/90">Threads</span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {openTabs.length > 0 ? (
            openTabs.map((tab) => (
              <div 
                key={tab.id}
                onClick={() => handlers.handleSwitchToTab(tab.id)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border border-transparent group",
                  "hover:bg-white/5 hover:border-white/10"
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                  <Terminal size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{tab.title}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{tab.backend || 'Claude'}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4 text-muted-foreground/30">
                <Terminal size={24} />
              </div>
              <p className="text-sm text-muted-foreground font-medium">No active sessions</p>
              <p className="text-xs text-muted-foreground/50 mt-1">Open a project to start an agent session.</p>
            </div>
          )}
        </div>
      </div>
    )
  } else if (activeSection === 'orchestration') {
    return (
      <div className="flex flex-col h-full bg-background/80 backdrop-blur-md animate-in slide-in-from-left duration-200">
        <div className="p-4 border-b border-border/50 font-bold flex items-center gap-2 bg-white/5">
          <Zap size={18} className="text-primary" />
          <span className="tracking-tight text-white/90">Automations</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-3">
            <h4 className="px-1 text-xs font-bold uppercase text-muted-foreground tracking-widest">GSD Task Status</h4>
            <div className="p-1 rounded-2xl bg-white/5 border border-white/5">
              <GSDStatus
                projectPath={beadsProjectPath}
                onCommand={(cmd) => {
                  if (focusedTabPtyId) {
                    api.writePty(focusedTabPtyId, cmd)
                    setTimeout(() => api.writePty(focusedTabPtyId, '\r'), 100)
                  }
                }}
              />
            </div>
          </div>
          
          <div className="space-y-3 pt-4 border-t border-white/5">
            <h4 className="px-1 text-xs font-bold uppercase text-muted-foreground tracking-widest">Active Beads</h4>
            <div className="p-1 rounded-2xl bg-white/5 border border-white/5">
              <BeadsPanel
                projectPath={beadsProjectPath}
                isExpanded={true}
                onToggle={() => {}}
                onStartTaskInNewTab={(prompt) => {
                  if (beadsProjectPath) onOpenSession(beadsProjectPath, undefined, undefined, prompt, true)
                }}
                onSendToCurrentTab={(prompt) => {
                  if (focusedTabPtyId) {
                    api.writePty(focusedTabPtyId, prompt)
                    setTimeout(() => api.writePty(focusedTabPtyId, '\r'), 100)
                  }
                }}
                currentTabPtyId={focusedTabPtyId}
              />
            </div>
          </div>
        </div>
      </div>
    )
  } else if (activeSection === 'plugins') {
    return (
      <div className="flex flex-col h-full bg-background/80 backdrop-blur-md animate-in slide-in-from-left duration-200">
        <div className="p-4 border-b border-border/50 font-semibold flex items-center gap-2">
          <Cpu size={18} />
          Plugins & Extensions
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="p-6 rounded-2xl bg-muted/30 border border-white/5 text-center">
            <Cpu size={40} className="mx-auto mb-4 text-primary opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Extension Engine</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Expand your capabilities with specialized tools and agents.
            </p>
            <button 
              onClick={() => setExtensionBrowserModal({ project: projects[0] || { path: '', name: 'Global' } })}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all"
            >
              Browse Extensions
            </button>
          </div>
          
          <div className="space-y-2">
            <h4 className="px-2 text-xs font-bold uppercase text-muted-foreground tracking-widest">Active Plugins</h4>
            <div className="p-3 rounded-xl bg-muted/20 border border-white/5 flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center text-green-500">
                  <Zap size={16} />
                </div>
                <div>
                  <div className="text-sm font-semibold">Tauri Backend</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Core System</div>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setMcpBrowserOpen(true)}
              className="w-full p-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 flex items-center justify-between group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <Cpu size={16} />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold">MCP Browser</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Tools & Resources</div>
                </div>
              </div>
              <ChevronRight size={14} className="text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    )
  } else if (activeSection === 'help') {
    return (
      <div className="flex flex-col h-full bg-background/80 backdrop-blur-md animate-in slide-in-from-left duration-200">
        <div className="p-4 border-b border-border/50 font-semibold flex items-center gap-2">
          <Settings size={18} />
          Help & Support
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-3">
            <h4 className="px-1 text-xs font-bold uppercase text-muted-foreground tracking-widest">Resources</h4>
            <button 
              onClick={() => checkForUpdate()}
              disabled={updateStatus.status === 'checking'}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 hover:border-white/10 group disabled:opacity-50"
            >
              <span className="text-sm">Check for Updates</span>
              {updateStatus.status === 'checking' ? (
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <ChevronRight size={14} className="text-muted-foreground group-hover:translate-x-1 transition-transform" />
              )}
            </button>
            <a 
              href="https://github.com/bobcat88/simple-code-gui/wiki" 
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 hover:border-white/10 group"
            >
              <span className="text-sm">Documentation</span>
              <ChevronRight size={14} className="text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </a>
            <a 
              href="https://github.com/bobcat88/simple-code-gui" 
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all border border-white/5 hover:border-white/10 group"
            >
              <span className="text-sm">GitHub Repository</span>
              <ChevronRight size={14} className="text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </a>
          </div>

          {updateStatus.status !== 'idle' && updateStatus.status !== 'checking' && (
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5 animate-in fade-in zoom-in duration-300">
              <div className="text-sm font-bold text-primary mb-1">
                {updateStatus.status === 'available' ? 'Update Available' : 
                 updateStatus.status === 'downloading' ? 'Downloading...' :
                 updateStatus.status === 'downloaded' ? 'Ready to Install' :
                 'Update Error'}
              </div>
              <div className="text-xs text-muted-foreground mb-3 leading-relaxed">
                {updateStatus.status === 'available' ? `Version ${updateStatus.version} is now available.` : 
                 updateStatus.status === 'downloading' ? `Fetching update files...` :
                 updateStatus.status === 'downloaded' ? `Restart the application to apply the update.` :
                 updateStatus.error || 'An unexpected error occurred.'}
              </div>
              
              {updateStatus.status === 'available' && (
                <button 
                  onClick={() => downloadUpdate()}
                  className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all shadow-md shadow-primary/20"
                >
                  Download Now
                </button>
              )}
              
              {updateStatus.status === 'downloaded' && (
                <button 
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
    )
  }

  return (
    <div className="flex flex-col h-full bg-background/80 backdrop-blur-sm animate-in slide-in-from-left duration-200">
      <div className="p-4 flex items-center justify-between border-b border-border/50">
        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/70">Projects</h2>
        <button
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all"
          onClick={handleAddCategory}
          title="Add category"
        >
          <Plus size={16} />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {/* All Projects meta-entry at top */}
        <div
          className="group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20"
          role="button"
          tabIndex={0}
          onClick={handleOpenAllProjects}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleOpenAllProjects()
            }
          }}
        >
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
            <Zap size={18} fill="currentColor" />
          </div>
          <span className="font-semibold text-sm text-foreground/80 group-hover:text-primary transition-colors">All Projects</span>
        </div>

        {sortedCategories.map((category) => {
          const categoryProjects = projectsByCategory[category.id] || []
          const { background: gradient, textDark } = getCategoryGradient(categoryProjects)

          return (
            <div
              key={category.id}
              className={`category-container ${dropTarget?.type === 'category' && dropTarget.id === category.id && !dropTarget.position ? 'drop-target' : ''}`}
            >
              {dropTarget?.type === 'category' &&
                dropTarget.id === category.id &&
                dropTarget.position === 'before' && <div className="drop-indicator" />}

              <CategoryHeader
                category={category}
                projectCount={categoryProjects.length}
                gradient={gradient}
                textDark={textDark}
                isCollapsed={category.collapsed || false}
                isDragging={draggedCategory === category.id}
                isEditing={editingCategory?.id === category.id}
                editingName={editingCategory?.id === category.id ? editingCategory.name : ''}
                editInputRef={categoryEditInputRef}
                draggedCategory={draggedCategory}
                draggedProject={draggedProject}
                onToggleCollapse={() => toggleCategoryCollapse(category.id)}
                onOpenAsProject={() => handleOpenCategoryAsProject(category.name)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setCategoryContextMenu({ x: e.clientX, y: e.clientY, category })
                }}
                onDragStart={(e) => handleCategoryDragStart(e, category.id)}
                onDragEnd={handleCategoryDragEnd}
                onCategoryHeaderDragOver={(e, position) =>
                  handleCategoryHeaderDragOver(e, category.id, position)
                }
                onCategoryDragOver={(e) => handleCategoryDragOver(e, category.id)}
                onCategoryHeaderDrop={(e) => handleCategoryHeaderDrop(e, category.id)}
                onCategoryDrop={(e) => handleCategoryDrop(e, category.id)}
                onStartRename={() => handleStartCategoryRename(category)}
                onEditingChange={(name) => setEditingCategory({ id: category.id, name })}
                onRenameSubmit={handleCategoryRenameSubmit}
                onRenameKeyDown={handleCategoryRenameKeyDown}
              />

              {dropTarget?.type === 'category' &&
                dropTarget.id === category.id &&
                dropTarget.position === 'after' && <div className="drop-indicator" />}

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
          )
        })}

        {(projectsByCategory['uncategorized']?.length > 0 || sortedCategories.length > 0) && (
          <div
            className={`uncategorized-section ${dropTarget?.type === 'uncategorized' ? 'drop-target' : ''}`}
            onDragOver={(e) => handleCategoryDragOver(e, null)}
            onDrop={(e) => handleCategoryDrop(e, null)}
          >
            {sortedCategories.length > 0 && projectsByCategory['uncategorized']?.length > 0 && (
              <div className="uncategorized-header">Uncategorized</div>
            )}
            {projectsByCategory['uncategorized'] && (
              <VirtualizedProjectList
                projects={projectsByCategory['uncategorized']}
                expandedProject={expandedProject}
                sessions={sessions}
                renderItem={renderProjectItem}
              />
            )}
          </div>
        )}

        {projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4 text-muted-foreground/30">
              <FolderPlus size={24} />
            </div>
            <p className="text-sm text-muted-foreground">No projects yet.</p>
            <p className="text-xs text-muted-foreground/50 mt-1">Add one to get started.</p>
          </div>
        )}
      </div>

      <div className="p-3 grid grid-cols-3 gap-2 border-t border-border/50">
        <button
          className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-muted/30 hover:bg-primary/10 hover:text-primary transition-all border border-transparent hover:border-primary/20 group"
          onClick={onOpenProjectWizard}
          title="Create new project from scratch"
        >
          <Plus size={16} className="group-hover:scale-125 transition-transform" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Make</span>
        </button>
        <button
          className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-muted/30 hover:bg-primary/10 hover:text-primary transition-all border border-transparent hover:border-primary/20 group"
          onClick={onAddProject}
          title="Add existing project folder"
        >
          <FolderPlus size={16} className="group-hover:scale-125 transition-transform" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Add</span>
        </button>
        <button
          className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-muted/30 hover:bg-primary/10 hover:text-primary transition-all border border-transparent hover:border-primary/20 group"
          onClick={onAddProjectsFromParent}
          title="Add all projects from a parent folder"
        >
          <FolderSearch size={16} className="group-hover:scale-125 transition-transform" />
          <span className="text-[10px] font-bold uppercase tracking-tighter">Scan</span>
        </button>
      </div>

      <SidebarActions
        focusedProject={focusedProject}
        apiStatus={focusedProjectPath ? apiStatus[focusedProjectPath] : undefined}
        isDebugMode={isDebugMode}
        api={api as any}
        onOpenProjectSettings={async (project) => {
          await handleOpenProjectSettings(project)
          setContextMenu(null)
        }}
        onToggleApi={async (project) => {
          await handleToggleApi(project)
          setContextMenu(null)
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
            await handleOpenProjectSettings(contextMenu.project)
            setContextMenu(null)
          }}
          onOpenExtensions={() => {
            setExtensionBrowserModal({ project: contextMenu.project })
            setContextMenu(null)
          }}
          onEditClaudeMd={() => {
            setClaudeMdEditorModal({ project: contextMenu.project })
            setContextMenu(null)
          }}
          onUpdateColor={(color) => onUpdateProject(contextMenu.project.path, { color })}
          onMoveToCategory={(categoryId) =>
            moveProjectToCategory(contextMenu.project.path, categoryId)
          }
          onCreateCategory={() => {
            const newId = addCategory('New Category')
            moveProjectToCategory(contextMenu.project.path, newId)
            setContextMenu(null)
            setEditingCategory({ id: newId, name: 'New Category' })
            setTimeout(() => categoryEditInputRef.current?.select(), 0)
          }}
          onDelete={() => {
            setDeleteConfirmModal({ project: contextMenu.project })
            setContextMenu(null)
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal && (
        <DeleteConfirmModal
          project={deleteConfirmModal.project}
          onClose={() => setDeleteConfirmModal(null)}
          onConfirm={() => {
            onRemoveProject(deleteConfirmModal.project.path)
            setDeleteConfirmModal(null)
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
            handleStartCategoryRename(categoryContextMenu.category)
            setCategoryContextMenu(null)
          }}
          onDelete={() => {
            removeCategory(categoryContextMenu.category.id)
            setCategoryContextMenu(null)
          }}
        />
      )}
      {/* MCP Browser Modal */}
      {mcpBrowserOpen && (
        <McpBrowser onClose={() => setMcpBrowserOpen(false)} />
      )}
    </div>
  )
}
