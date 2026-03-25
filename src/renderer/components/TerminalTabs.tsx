import React, { useCallback, useState, useRef, memo, RefObject } from 'react'
import { OpenTab } from '../stores/workspace'
import { useIsMobile } from '../hooks/useIsMobile'
import { useSwipeGesture } from '../hooks/useSwipeGesture'
import { SwipeDots } from './mobile/SwipeDots'

interface TabItemProps {
  tab: OpenTab
  isActive: boolean
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onRename: (id: string, title: string) => void
  onNewSession: (projectPath: string) => void
}

const TabItem = memo(function TabItem({ tab, isActive, onSelect, onClose, onRename, onNewSession }: TabItemProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelledRef = useRef(false)

  const handleClick = useCallback(() => {
    if (!editing) onSelect(tab.id)
  }, [onSelect, tab.id, editing])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(tab.id)
    }
  }, [onSelect, tab.id])

  const handleClose = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onClose(tab.id)
  }, [onClose, tab.id])

  const handleNewSession = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onNewSession(tab.projectPath)
  }, [onNewSession, tab.projectPath])

  const startRename = useCallback(() => {
    setEditing(true)
    setEditValue(tab.title)
    cancelledRef.current = false
    setTimeout(() => inputRef.current?.select(), 0)
  }, [tab.title])

  const commitRename = useCallback(() => {
    if (cancelledRef.current) return
    if (editValue.trim()) {
      onRename(tab.id, editValue.trim())
    }
    setEditing(false)
  }, [tab.id, editValue, onRename])

  const cancelRename = useCallback(() => {
    cancelledRef.current = true
    setEditing(false)
  }, [])

  return (
    <div
      className={`tab ${isActive ? 'active' : ''}`}
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {editing ? (
        <input
          ref={inputRef}
          className="tab-title-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitRename() }
            else if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
            e.stopPropagation()
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      ) : (
        <span className="tab-title" title={tab.title} onDoubleClick={(e) => { e.stopPropagation(); startRename() }}>{tab.title}</span>
      )}
      <button
        className="tab-new-session"
        onClick={handleNewSession}
        title="New session from this project"
        aria-label="New session from this project"
      >
        +
      </button>
      <button
        className="tab-close"
        onClick={handleClose}
        title="Close tab"
        aria-label="Close tab"
      >
        ×
      </button>
    </div>
  )
})

interface TerminalTabsProps {
  tabs: OpenTab[]
  activeTabId: string | null
  onSelectTab: (id: string) => void
  onCloseTab: (id: string) => void
  onRenameTab: (id: string, title: string) => void
  onNewSession: (projectPath: string) => void
  swipeContainerRef?: RefObject<HTMLElement>  // For mobile swipe gestures
  onOpenSidebar?: () => void  // For mobile right-edge swipe
}

export function TerminalTabs({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onRenameTab,
  onNewSession,
  swipeContainerRef,
  onOpenSidebar
}: TerminalTabsProps) {
  const { isMobile } = useIsMobile()

  // Calculate current tab index
  const currentIndex = tabs.findIndex(t => t.id === activeTabId)

  // Navigation helpers
  const goToNextTab = useCallback(() => {
    if (tabs.length <= 1) return
    const idx = currentIndex === -1 ? 0 : currentIndex
    const newIndex = (idx + 1) % tabs.length
    onSelectTab(tabs[newIndex].id)
  }, [tabs, currentIndex, onSelectTab])

  const goToPrevTab = useCallback(() => {
    if (tabs.length <= 1) return
    const idx = currentIndex === -1 ? 0 : currentIndex
    const newIndex = (idx - 1 + tabs.length) % tabs.length
    onSelectTab(tabs[newIndex].id)
  }, [tabs, currentIndex, onSelectTab])

  const goToTabByIndex = useCallback((index: number) => {
    if (index >= 0 && index < tabs.length) {
      onSelectTab(tabs[index].id)
    }
  }, [tabs, onSelectTab])

  // Setup swipe gesture for mobile (using provided container ref)
  useSwipeGesture(swipeContainerRef as RefObject<HTMLElement>, {
    onSwipeLeft: goToNextTab,
    onSwipeRight: goToPrevTab,
    onSwipeRightEdge: onOpenSidebar,
  })

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (tabs.length <= 1) return
    if (currentIndex === -1) return

    // Scroll down (positive deltaY) = next tab, scroll up = previous tab
    const direction = e.deltaY > 0 ? 1 : -1
    const newIndex = (currentIndex + direction + tabs.length) % tabs.length
    onSelectTab(tabs[newIndex].id)
  }, [tabs, currentIndex, onSelectTab])

  // Mobile: render SwipeDots instead of full tab bar
  if (isMobile) {
    return (
      <SwipeDots
        current={currentIndex === -1 ? 0 : currentIndex}
        total={tabs.length}
        onDotClick={goToTabByIndex}
      />
    )
  }

  // Desktop: render standard tab bar
  return (
    <div className="tabs-bar" onWheel={handleWheel} role="tablist" aria-label="Terminal sessions">
      {tabs.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onSelect={onSelectTab}
          onClose={onCloseTab}
          onRename={onRenameTab}
          onNewSession={onNewSession}
        />
      ))}
    </div>
  )
}
