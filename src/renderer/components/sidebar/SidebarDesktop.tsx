import React from 'react'
import { SidebarContent, SidebarContentProps } from './SidebarContent.js'
import { SidebarState } from './useSidebarState.js'
import { SidebarHandlers } from './useSidebarHandlers.js'
import { useIntelligence } from './hooks/useIntelligence.js'
import { IntelligencePanel } from './IntelligencePanel.js'

export interface SidebarDesktopProps extends Omit<SidebarContentProps, 'state' | 'handlers'> {
  state: SidebarState
  handlers: SidebarHandlers
  width: number
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}

export function SidebarDesktop(props: SidebarDesktopProps): React.ReactElement {
  const { state, handlers, width, collapsed, onCollapsedChange, ...contentProps } = props
  const { sidebarRef } = state
  const { handleMouseDown } = handlers

  // Fetch intelligence for the currently focused project
  const focusedSession = contentProps.sessions.find(s => s.isFocused)
  const { intelligence, loading, error } = useIntelligence(focusedSession?.path || null)

  return (
    <div className="sidebar" ref={sidebarRef} style={{ width }}>
      <button
        className="sidebar-collapse-btn"
        onClick={() => onCollapsedChange(true)}
        title="Collapse sidebar"
        aria-label="Collapse sidebar"
      >
        ◀
      </button>

      <SidebarContent state={state} handlers={handlers} {...contentProps} />

      {!collapsed && (
        <IntelligencePanel 
          intelligence={intelligence} 
          loading={loading} 
          error={error} 
          projectName={focusedSession?.name || null}
        />
      )}

      <div className="sidebar-resize-handle" onMouseDown={handleMouseDown} />
    </div>
  )
}

export interface SidebarCollapsedProps {
  sidebarRef: React.RefObject<HTMLDivElement>
  onCollapsedChange: (collapsed: boolean) => void
}

export function SidebarCollapsed(props: SidebarCollapsedProps): React.ReactElement {
  const { sidebarRef, onCollapsedChange } = props

  return (
    <div className="sidebar collapsed" ref={sidebarRef}>
      <button
        className="sidebar-collapse-btn"
        onClick={() => onCollapsedChange(false)}
        title="Expand sidebar"
        aria-label="Expand sidebar"
      >
        ▶
      </button>
    </div>
  )
}
