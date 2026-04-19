import React from 'react'
import { SidebarContent, SidebarContentProps } from './SidebarContent.js'
import { SidebarState } from './useSidebarState.js'
import { SidebarHandlers } from './useSidebarHandlers.js'
import { ChevronLeft, ChevronRight } from 'lucide-react'

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

  return (
    <div className="sidebar-container relative group" style={{ width }}>
      <div className="sidebar h-full overflow-hidden" ref={sidebarRef}>
        <SidebarContent state={state} handlers={handlers} activeSection={props.activeSection} {...contentProps} />
      </div>

      <button
        className="collapse-bubble"
        onClick={() => onCollapsedChange(true)}
        title="Collapse sidebar"
      >
        <ChevronLeft size={14} />
      </button>

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
    <div className="sidebar collapsed relative group" ref={sidebarRef}>
      <button
        className="collapse-bubble"
        style={{ right: '-12px' }}
        onClick={() => onCollapsedChange(false)}
        title="Expand sidebar"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  )
}
