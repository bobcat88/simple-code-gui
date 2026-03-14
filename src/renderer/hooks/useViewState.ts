import { useState, useCallback } from 'react'
import type { TileNode } from '../components/tile-tree.js'

type ViewMode = 'tabs' | 'tiled'

interface UseViewStateReturn {
  viewMode: ViewMode
  tileTree: TileNode | null
  lastFocusedTabId: string | null
  sidebarWidth: number
  sidebarCollapsed: boolean
  setViewMode: (mode: ViewMode) => void
  setTileTree: (tree: TileNode | null) => void
  setLastFocusedTabId: (id: string | null) => void
  setSidebarWidth: (width: number) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleViewMode: () => void
}

export function useViewState(): UseViewStateReturn {
  const [viewMode, setViewModeState] = useState<ViewMode>('tabs')
  const [tileTree, setTileTree] = useState<TileNode | null>(null)
  const [lastFocusedTabId, setLastFocusedTabId] = useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(280)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode)
    // Trigger resize events to force terminals to refit after view mode change
    setTimeout(() => window.dispatchEvent(new Event('resize')), 50)
    setTimeout(() => window.dispatchEvent(new Event('resize')), 150)
    setTimeout(() => window.dispatchEvent(new Event('resize')), 300)
  }, [])

  const toggleViewMode = useCallback(() => {
    setViewMode(viewMode === 'tabs' ? 'tiled' : 'tabs')
  }, [viewMode, setViewMode])

  return {
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
    toggleViewMode
  }
}
