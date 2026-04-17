import React from 'react'
import { Project, useWorkspaceStore } from '../../stores/workspace.js'
import { Settings, LayoutGrid, Terminal, Plus, FolderPlus, FolderSearch, Zap } from 'lucide-react'
import { cn } from '../../lib/utils'
import { BeadsPanel } from '../BeadsPanel.js'
import { GSDStatus } from '../GSDStatus.js'
import { ExtensionBrowser } from '../ExtensionBrowser.js'
import { ClaudeMdEditor } from '../ClaudeMdEditor.js'
import { McpPanel } from '../McpPanel.js'
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
  activeTabId: string | null
  focusedTabId: string | null
  activeSection?: string
  onOpenSession: SidebarProps['onOpenSession']
  onRemoveProject: SidebarProps['onRemoveProject']
  onUpdateProject: SidebarProps['onUpdateProject']
  onAddProject: SidebarProps['onAddProject']
  onAddProjectsFromParent: SidebarProps['onAddProjectsFromParent']
  onOpenSettings: SidebarProps['onOpenSettings']
  onOpenMakeProject: SidebarProps['onOpenMakeProject']
  onOpenMobileConnect: SidebarProps['onOpenMobileConnect']
  renderProjectItem: (project: Project) => React.ReactElement
}

export function SidebarContent(props: SidebarContentProps): React.ReactElement {
  const {
    state,
    handlers,
    projects,
    activeTabId,
    focusedTabId,
    activeSection = 'terminal',
    onOpenSession,
    onRemoveProject,
    onUpdateProject,
    onAddProject,
    onAddProjectsFromParent,
    onOpenSettings,
    onOpenMakeProject,
    onOpenMobileConnect,
    renderProjectItem,
  } = props

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
      <div className="flex flex-col h-full bg-background animate-in slide-in-from-left duration-200">
        <div className="p-4 border-b border-border font-semibold flex items-center gap-2">
          <Settings size={18} />
          Configuration
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          <div className="space-y-1">
            <h3 className="px-2 py-1 text-xs font-bold uppercase text-muted-foreground tracking-wider">Agents & Tracking</h3>
            <BeadsPanel
              projectPath={beadsProjectPath}
              isExpanded={true}
              onToggle={() => {}}
              onStartTaskInNewTab={(prompt) => {
                if (beadsProjectPath) onOpenSession(beadsProjectPath, undefined, undefined, prompt, true)
              }}
              onSendToCurrentTab={(prompt) => {
                if (focusedTabPtyId) {
                  window.electronAPI?.writePty(focusedTabPtyId, prompt)
                  setTimeout(() => window.electronAPI?.writePty(focusedTabPtyId, '\r'), 100)
                }
              }}
              currentTabPtyId={focusedTabPtyId}
            />
            <GSDStatus
              projectPath={beadsProjectPath}
              onCommand={(cmd) => {
                if (focusedTabPtyId) {
                  window.electronAPI?.writePty(focusedTabPtyId, cmd)
                  setTimeout(() => window.electronAPI?.writePty(focusedTabPtyId, '\r'), 100)
                }
              }}
            />
          </div>

          <div className="pt-2 border-t border-border/50">
            <McpPanel projectPath={beadsProjectPath} />
          </div>
          
          <div className="space-y-1 pt-4">
            <h3 className="px-2 py-1 text-xs font-bold uppercase text-muted-foreground tracking-wider">Global Settings</h3>
            <button 
              onClick={onOpenSettings}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors flex items-center gap-2 text-sm"
            >
              <LayoutGrid size={16} />
              Appearance & Backend
            </button>
            <button 
              onClick={onOpenMobileConnect}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-muted transition-colors flex items-center gap-2 text-sm"
            >
              <Terminal size={16} />
              Mobile Connection (QR)
            </button>
          </div>
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
          onClick={onOpenMakeProject}
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

      <div className="px-3 pb-3">
        {voiceOutputEnabled && (
          <VoiceOptionsPanel
            volume={volume}
            speed={speed}
            skipOnNew={skipOnNew}
            onVolumeChange={setVolume}
            onSpeedChange={setSpeed}
            onSkipOnNewChange={setSkipOnNew}
          />
        )}
      </div>

      <SidebarActions
        activeTabId={activeTabId}
        focusedTabId={focusedTabId}
        focusedProject={focusedProject}
        apiStatus={focusedProjectPath ? apiStatus[focusedProjectPath] : undefined}
        isDebugMode={isDebugMode}
        onOpenSettings={onOpenSettings}
        onOpenProjectSettings={async (project) => {
          await handleOpenProjectSettings(project)
          setContextMenu(null)
        }}
        onToggleApi={async (project) => {
          await handleToggleApi(project)
          setContextMenu(null)
        }}
        onOpenMobileConnect={onOpenMobileConnect}
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
    </div>
  )
}
