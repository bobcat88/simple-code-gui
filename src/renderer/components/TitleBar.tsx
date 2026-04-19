import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Minimize2, Maximize2, Square, X, Copy } from 'lucide-react'

import type { Api } from '../api'

interface TitleBarProps {
  api: Api
  title?: string
}

export function TitleBar({ api, title = 'Simple Code GUI' }: TitleBarProps) {
  const [isMaximized, setIsMaximized] = useState(false)
  const throttleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCallRef = useRef<number>(0)

  const checkMaximized = useCallback(() => {
    api.windowIsMaximized?.().then(setIsMaximized)
  }, [api])

  useEffect(() => {
    // Check initial state
    checkMaximized()

    // Throttled resize handler - limits IPC calls to once per 150ms
    const handleResize = () => {
      const now = Date.now()
      const timeSinceLastCall = now - lastCallRef.current

      if (timeSinceLastCall >= 150) {
        // Enough time has passed, call immediately
        lastCallRef.current = now
        checkMaximized()
      } else if (!throttleTimeoutRef.current) {
        // Schedule a trailing call
        throttleTimeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now()
          throttleTimeoutRef.current = null
          checkMaximized()
        }, 150 - timeSinceLastCall)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current)
      }
    }
  }, [checkMaximized])

  const handleMinimize = () => {
    api.windowMinimize()
  }

  const handleMaximize = () => {
    api.windowMaximize()
    // Update state after a short delay to allow window to change
    setTimeout(() => {
      api.windowIsMaximized?.().then(setIsMaximized)
    }, 100)
  }

  const handleClose = () => {
    api.windowClose()
  }

  return (
    <div className="title-bar" data-tauri-drag-region>
      <div className="title-bar-drag" data-tauri-drag-region>
        <span className="title-bar-title" data-tauri-drag-region>{title}</span>
      </div>
      <div className="title-bar-controls">
        <button
          className="title-bar-btn minimize"
          onClick={handleMinimize}
          title="Minimize"
          aria-label="Minimize window"
        >
          <Minimize2 size={14} />
        </button>
        <button
          className="title-bar-btn maximize"
          onClick={handleMaximize}
          title={isMaximized ? 'Restore' : 'Maximize'}
          aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
        >
          {isMaximized ? <Copy size={13} style={{ transform: 'rotate(180deg)' }} /> : <Square size={13} />}
        </button>
        <button
          className="title-bar-btn close"
          onClick={handleClose}
          title="Close"
          aria-label="Close window"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
