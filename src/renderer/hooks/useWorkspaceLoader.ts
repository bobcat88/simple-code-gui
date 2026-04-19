import { useEffect, useRef, useState, useCallback } from 'react'
import type { Api } from '../api'
import type { BackendId } from '../api/types'
import type { AppSettings } from './useSettings'
import { useWorkspaceStore } from '../stores/workspace'
import { Theme, getThemeById, applyTheme, themes } from '../themes'
import { applyGlobalStyling } from '../themes/applyTheme'
import { cleanupOrphanedBuffers } from '../components/terminal/Terminal'
import type { TileNode } from '../components/tile-tree.js'
import { deserializeTree, migrateFromFlat, remapTabIds, filterTabs } from '../components/tile-tree.js'
import { calculatePtyDimensions } from '../components/terminal/utils.js'

interface UseWorkspaceLoaderOptions {
  api: Api
  checkInstallation: () => Promise<void>
  setViewMode: (mode: 'tabs' | 'tiled') => void
  setTileTree: (tree: TileNode | null) => void
}

interface UseWorkspaceLoaderReturn {
  loading: boolean
  currentTheme: Theme
  settings: AppSettings | null
  setCurrentTheme: (theme: Theme) => void
  setSettings: (settings: AppSettings | null) => void
}

export function useWorkspaceLoader({
  api,
  checkInstallation,
  setViewMode,
  setTileTree
}: UseWorkspaceLoaderOptions): UseWorkspaceLoaderReturn {
  const {
    setProjects,
    setCategories,
    addTab,
    clearTabs
  } = useWorkspaceStore()

  const [loading, setLoading] = useState(true)
  const [currentTheme, setCurrentTheme] = useState<Theme>(themes[0])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const initRef = useRef(false)
  const hadProjectsRef = useRef(false)

  // Load workspace on mount and restore tabs
  useEffect(() => {
    // Prevent double initialization from StrictMode
    if (initRef.current) return
    initRef.current = true

    const loadWorkspace = async () => {
      try {
        // Check if Claude, npm, and git-bash are installed
        await checkInstallation()

        // Load and apply theme with any saved customizations
        const loadedSettings = await api.getSettings()
        setSettings(loadedSettings)
        const theme = getThemeById(loadedSettings.theme || 'default')
        applyTheme(theme, loadedSettings.themeCustomization)
        
        // Apply global Codex styling
        applyGlobalStyling(
          loadedSettings.themeCustomization?.accentColor || '#3b82f6',
          true
        )
        
        setCurrentTheme(theme)

        // Kill any existing PTYs from hot reload (but don't clear buffers - they'll be restored)
        const existingTabs = useWorkspaceStore.getState().openTabs
        for (const tab of existingTabs) {
          api.killPty(tab.id)
        }
        clearTabs()

        const workspace = await api.getWorkspace()
        if (workspace.projects) {
          setProjects(workspace.projects)
          if (workspace.projects.length > 0) {
            hadProjectsRef.current = true
          }
          // Install TTS instructions for all existing projects
          for (const project of workspace.projects) {
            await api.ttsInstallInstructions?.(project.path)
          }
        }
        // Load categories
        if (workspace.categories) {
          setCategories(workspace.categories)
        }

        // Restore previously open tabs (only if not already open)
        // Track old ID -> new ID mapping for layout restoration
        const idMapping = new Map<string, string>()

        if (workspace.openTabs && workspace.openTabs.length > 0) {
          const currentTabs = useWorkspaceStore.getState().openTabs
          const usedSessionIds = new Set(currentTabs.map(t => t.sessionId).filter(Boolean))
          const sessionsCache = new Map<string, { list: { sessionId: string; slug: string }[]; nextIndex: number }>()

          for (const savedTab of workspace.openTabs) {
            try {
              // Always install TTS instructions so Claude uses <tts> tags
              await api.ttsInstallInstructions?.(savedTab.projectPath)

              const projectName = savedTab.projectPath.split(/[/\\]/).pop() || savedTab.projectPath
              let titleToRestore = savedTab.title || `${projectName} - New`

              // Get project and determine effective backend for restored tab
              const projectForTab = workspace.projects?.find((p: { path: string }) => p.path === savedTab.projectPath)
              const savedBackend = savedTab.backend
              const effectiveBackendForTab = (savedBackend
                || (projectForTab?.backend && projectForTab.backend !== 'default'
                  ? projectForTab.backend
                  : (loadedSettings?.backend && loadedSettings.backend !== 'default'
                    ? loadedSettings.backend
                    : 'claude'))) as BackendId

              let sessionIdToRestore: string | undefined = savedTab.sessionId

              // Discover sessions for this project
              let sessionsForProject = sessionsCache.get(savedTab.projectPath)
              if (!sessionsForProject) {
                const list = await api.discoverSessions(savedTab.projectPath, effectiveBackendForTab)
                sessionsForProject = { list, nextIndex: 0 }
                sessionsCache.set(savedTab.projectPath, sessionsForProject)
              }

              const list = sessionsForProject.list || []

              // Try to match the saved sessionId first to preserve tab order
              if (savedTab.sessionId) {
                const savedMatch = list.find(s => s.sessionId === savedTab.sessionId)
                if (savedMatch && !usedSessionIds.has(savedMatch.sessionId)) {
                  sessionIdToRestore = savedMatch.sessionId
                  // Only update title if user hasn't customized it
                  if (!savedTab.customTitle) {
                    titleToRestore = `${projectName} - ${savedMatch.slug}`
                  }
                } else {
                  // Saved session not found or already used — fall back to next available
                  for (let i = sessionsForProject.nextIndex; i < list.length; i++) {
                    const candidate = list[i]
                    if (!usedSessionIds.has(candidate.sessionId)) {
                      sessionIdToRestore = candidate.sessionId
                      if (!savedTab.customTitle) {
                        titleToRestore = `${projectName} - ${candidate.slug}`
                      }
                      sessionsForProject.nextIndex = i + 1
                      break
                    }
                  }
                }
              } else {
                // No saved session — find first available
                for (let i = sessionsForProject.nextIndex; i < list.length; i++) {
                  const candidate = list[i]
                  if (!usedSessionIds.has(candidate.sessionId)) {
                    sessionIdToRestore = candidate.sessionId
                    if (!savedTab.customTitle) {
                      titleToRestore = `${projectName} - ${candidate.slug}`
                    }
                    sessionsForProject.nextIndex = i + 1
                    break
                  }
                }
              }

              // Use window size as a fallback estimate for initial spawning
              const { cols, rows } = calculatePtyDimensions(window.innerWidth, window.innerHeight)

              const ptyId = await api.spawnPty(
                savedTab.projectPath,
                sessionIdToRestore,
                undefined,
                effectiveBackendForTab,
                rows,
                cols
              )
              if (savedTab.id) {
                idMapping.set(savedTab.id, ptyId)
              }

              addTab({
                id: ptyId,
                projectPath: savedTab.projectPath,
                sessionId: sessionIdToRestore,
                title: titleToRestore,
                customTitle: savedTab.customTitle || undefined,
                ptyId,
                backend: effectiveBackendForTab
              })
              if (sessionIdToRestore) {
                usedSessionIds.add(sessionIdToRestore)
              }
            } catch (e) {
              console.error('Failed to restore tab:', savedTab.projectPath, e)
            }
          }
        } else {
          // Auto-spawn default Claude session if nothing was restored
          try {
            const defaultPath = workspace.projects?.[0]?.path || '.'
            
            // Use window size as a fallback estimate
            const { cols, rows } = calculatePtyDimensions(window.innerWidth, window.innerHeight)

            const ptyId = await api.spawnPty(defaultPath, undefined, undefined, 'claude', rows, cols)
            addTab({
              id: ptyId,
              projectPath: defaultPath,
              title: 'Claude Code',
              ptyId,
              backend: 'claude'
            })
          } catch (e) {
            console.error('Failed to auto-spawn default session:', e)
          }
        }

        // Clean up orphaned terminal buffers from previous session/HMR
        const activeTabIds = useWorkspaceStore.getState().openTabs.map(t => t.id)
        cleanupOrphanedBuffers(activeTabIds)

        // Restore view mode
        if (workspace.viewMode) {
          setViewMode(workspace.viewMode)
        }

        // Restore tile tree with mapped IDs
        if (idMapping.size > 0) {
          const currentTabIds = new Set(useWorkspaceStore.getState().openTabs.map(t => t.id))

          let restoredTree: TileNode | null = null

          // Prefer tileTree (new format)
          if (workspace.tileTree) {
            restoredTree = deserializeTree(workspace.tileTree)
          }
          // Fall back to tileLayout (legacy flat format)
          else if (workspace.tileLayout && workspace.tileLayout.length > 0) {
            // Remap IDs in the flat layout before migrating
            const mappedLayout = workspace.tileLayout
              .map((tile: any) => {
                const tabIds = (tile.tabIds || [tile.id]).map((id: string) => idMapping.get(id) || id)
                const newId = idMapping.get(tile.id) || tabIds[0]
                const activeTabId = tile.activeTabId
                  ? (idMapping.get(tile.activeTabId) || tabIds[0])
                  : tabIds[0]
                return { ...tile, id: newId, tabIds, activeTabId }
              })
            restoredTree = migrateFromFlat(mappedLayout)
          }

          if (restoredTree) {
            // Remap IDs in the tree
            restoredTree = remapTabIds(restoredTree, idMapping)
            // Filter out tabs that don't exist in the current session
            restoredTree = filterTabs(restoredTree, currentTabIds)
          }

          if (restoredTree) {
            setTileTree(restoredTree)
          }
        }
      } catch (e) {
        console.error('Failed to load workspace:', e)
      }
      setLoading(false)
    }
    loadWorkspace()
  }, [api, addTab, clearTabs, checkInstallation, setProjects, setCategories, setViewMode, setTileTree])

  // Listen for settings changes from other windows or backend
  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    
    const setupListener = async () => {
      if (api.onSettingsChanged) {
        unsubscribe = await api.onSettingsChanged((newSettings) => {
          console.log('[WorkspaceLoader] Settings changed via IPC:', newSettings)
          setSettings(newSettings)
          
          // Re-apply styling if needed
          applyGlobalStyling(
            newSettings.themeCustomization?.accentColor || '#3b82f6',
            true
          )
          
          const theme = getThemeById(newSettings.theme || 'default')
          applyTheme(theme, newSettings.themeCustomization)
          setCurrentTheme(theme)
        })
      }
    }
    
    setupListener()
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [api, setCurrentTheme])

  return {
    loading,
    currentTheme,
    settings,
    setCurrentTheme,
    setSettings
  }
}
