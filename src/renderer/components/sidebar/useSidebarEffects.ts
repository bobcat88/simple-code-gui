import { useEffect, useCallback } from 'react'
import { Project } from '../../stores/workspace.js'
import { useSwipeGesture } from '../../hooks/useSwipeGesture.js'
import { SidebarState } from './useSidebarState.js'
import { useApi } from '../../contexts/ApiContext'
import type { ExtendedApi } from '../../api/types'


export interface UseSidebarEffectsParams {
  state: SidebarState
  projects: Project[]
  isMobile: boolean
  isMobileOpen: boolean | undefined
  onMobileClose: (() => void) | undefined
  onWidthChange: (width: number) => void
}

export function useSidebarEffects(params: UseSidebarEffectsParams): void {
  const { state, projects, isMobile, isMobileOpen, onMobileClose, onWidthChange } = params
  const {
    sidebarRef,
    isResizing,
    setIsResizing,
    contextMenu,
    categoryContextMenu,
    setContextMenu,
    setCategoryContextMenu,
    setApiStatus,
    setTaskCounts,
    focusedProjectPath,
    setIsDebugMode,
  } = state
  const api = useApi() as ExtendedApi

  // Swipe to close on mobile (swipe left to close drawer)
  useSwipeGesture(sidebarRef, {
    onSwipeLeft: isMobile && isMobileOpen ? onMobileClose : undefined,
    threshold: 50,
  })

  // Resize handling
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [setIsResizing])

  useEffect(() => {
    let rafId: number | null = null
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      if (rafId !== null) return
      rafId = requestAnimationFrame(() => {
        rafId = null
        const newWidth = Math.min(Math.max(e.clientX, 200), 500)
        onWidthChange(newWidth)
      })
    }
    const handleMouseUp = () => setIsResizing(false)

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, onWidthChange, setIsResizing])

  // Close context menus on click
  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null)
      setCategoryContextMenu(null)
    }
    if (contextMenu || categoryContextMenu) {
      document.addEventListener('click', handleClick)
      return () => document.removeEventListener('click', handleClick)
    }
  }, [contextMenu, categoryContextMenu, setContextMenu, setCategoryContextMenu])

  // Fetch API status when context menu opens
  useEffect(() => {
    if (contextMenu && api?.apiStatus) {
      api.apiStatus(contextMenu.project.path).then((status) => {
        setApiStatus((prev) => ({ ...prev, [contextMenu.project.path]: status }))
      })
    }
  }, [contextMenu, setApiStatus, api])

  // Fetch task counts for all projects
  useEffect(() => {
    async function fetchTaskCounts(): Promise<void> {
      if (!api?.beadsCheck) return
      const counts: Record<string, { open: number; inProgress: number }> = {}
      for (const project of projects) {
        try {
          const status = await api.beadsCheck(project.path)
          if (status.installed && status.initialized && api.beadsList) {
            const result = await api.beadsList(project.path)
            if (result.success && result.tasks) {
              const tasks = result.tasks as Array<{ status: string }>
              const open = tasks.filter((t) => t.status === 'open').length
              const inProgress = tasks.filter((t) => t.status === 'in_progress').length
              counts[project.path] = { open, inProgress }
            }
          }
        } catch {
          /* ignore */
        }
      }
      setTaskCounts(counts)
    }
    fetchTaskCounts()
    const interval = setInterval(fetchTaskCounts, 30000)
    return () => clearInterval(interval)
  }, [projects, setTaskCounts, api])

  // Fetch API status for focused project
  useEffect(() => {
    if (focusedProjectPath && api?.apiStatus) {
      api.apiStatus(focusedProjectPath).then((status) => {
        setApiStatus((prev) => ({ ...prev, [focusedProjectPath]: status }))
      })
    }
  }, [focusedProjectPath, setApiStatus, api])

  // Check debug mode on mount
  useEffect(() => {
    api?.isDebugMode?.()?.then(setIsDebugMode)
  }, [setIsDebugMode, api])

  // Export handleMouseDown for use in the component
  return
}

export function useResizeHandler(
  setIsResizing: (v: boolean) => void
): (e: React.MouseEvent) => void {
  return useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsResizing(true)
    },
    [setIsResizing]
  )
}
