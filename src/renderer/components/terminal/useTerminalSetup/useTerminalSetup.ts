import { useEffect, useRef, useState } from 'react'
import type { Terminal as XTerm } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import { getLastTerminalTheme } from '../../../themes.js'
import { setupXtermErrorHandler } from '../utils.js'
import type { UseTerminalSetupOptions, UseTerminalSetupReturn, PtyOperations } from './types.js'
import {
  initTerminal,
  handlePtyData,
  handlePtyExit,
  createInitState,
  cleanupTerminal,
} from './terminalInit.js'
import { createThemeUpdateHandler } from './eventHandlers.js'
import { useApi } from '../../../contexts/ApiContext'

// Setup error handler on module load
setupXtermErrorHandler()

/**
 * Creates PTY operations from the provided API.
 */
function createPtyOperations(api: UseTerminalSetupOptions['api']): PtyOperations {
  return {
    writePty: (id: string, data: string) => {
      api?.writePty(id, data)
    },
    resizePty: (id: string, cols: number, rows: number) => {
      api?.resizePty(id, cols, rows)
    },
    onPtyData: (id: string, callback: (data: string) => void) => {
      return api?.onPtyData(id, callback) || (() => {})
    },
    onPtyExit: (id: string, callback: (code: number) => void) => {
      return api?.onPtyExit(id, callback) || (() => {})
    },
    onPtyTitle: (id: string, callback: (title: string) => void) => {
      return api?.onPtyTitle?.(id, callback) || (() => {})
    },
    onPtyPath: (id: string, callback: (path: string) => void) => {
      return api?.onPtyPath?.(id, callback) || (() => {})
    },
    onPtyPid: (id: string, callback: (pid: string) => void) => {
      return api?.onPtyPid?.(id, callback) || (() => {})
    },
    onPtyRecreated: (callback: (data: { oldId: string; newId: string; backend: any }) => void) => {
      return api?.onPtyRecreated?.(callback) || (() => {})
    },
  }
}

/**
 * Hook for setting up and managing the xterm.js terminal instance.
 * Handles terminal creation, PTY communication, WebGL addon, and event handlers.
 */
export function useTerminalSetup(options: UseTerminalSetupOptions): UseTerminalSetupReturn {
  const contextApi = useApi()
  const [isReady, setIsReady] = useState(false)
  const {
    ptyId,
    theme,
    api: overrideApi,
    onTTSChunk,
    onSummaryChunk,
    onAutoWorkMarker,
    onTokenChunk,
    resetTTSState,
  } = options

  const api = overrideApi || contextApi

  const containerRef = useRef<HTMLDivElement>(null!)
  const terminalRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const userScrolledUpRef = useRef(false)
  const currentLineInputRef = useRef<string>('')
  const inputSuppressedRef = useRef<boolean>(false)

  const ptyOperations = createPtyOperations(api)

  // Main terminal setup effect
  useEffect(() => {
    if (!containerRef.current) return

    const state = createInitState()
    let initCheckInterval: ReturnType<typeof setInterval> | null = null
    let cleanupData: (() => void) | undefined
    let cleanupExit: (() => void) | undefined

    // Reset TTS state for this terminal session
    resetTTSState()

    // Try to initialize terminal
    const tryInit = (): boolean => {
      return initTerminal(
        containerRef,
        terminalRef,
        fitAddonRef,
        userScrolledUpRef,
        currentLineInputRef,
        inputSuppressedRef,
        theme,
        ptyOperations,
        ptyId,
        options,
        state,
        () => setIsReady(true)
      )
    }

    // PTY output handling
    cleanupData = ptyOperations.onPtyData(ptyId, (data) => {
      handlePtyData(
        data,
        state.terminal,
        state.fitAddon,
        containerRef,
        userScrolledUpRef,
        ptyOperations,
        ptyId,
        onTTSChunk,
        onSummaryChunk,
        onAutoWorkMarker,
        onTokenChunk,
        options.api,
        state
      )
    })

    // PTY exit handling
    cleanupExit = ptyOperations.onPtyExit(ptyId, (code) => {
      handlePtyExit(code, state.terminal, ptyId, state)
      options.onSessionEnded?.()
    })

    // PTY title/path/pid handling
    const cleanupTitle = ptyOperations.onPtyTitle?.(ptyId, (title) => options.onTerminalTitle?.(title))
    const cleanupPath = ptyOperations.onPtyPath?.(ptyId, (path) => options.onTerminalPath?.(path))
    const cleanupPid = ptyOperations.onPtyPid?.(ptyId, (pid) => options.onProcessId?.(pid))

    // Listen for PTY recreation (backend switching)
    const cleanupRecreated = ptyOperations.onPtyRecreated?.((data) => {
      if (data.oldId === ptyId && state.terminal) {
        console.log(`[Terminal] PTY recreated (${data.backend}), clearing terminal`)
        state.terminal.clear()
        // Optionally reset TTS state or other session-specific state
        resetTTSState()
      }
    })

    // Try to initialize terminal immediately, or poll until ready
    if (!tryInit()) {
      initCheckInterval = setInterval(() => {
        if (tryInit()) {
          clearInterval(initCheckInterval!)
          initCheckInterval = null
        }
      }, 50)
    }

    // Listen for theme customization updates
    let handleThemeUpdate: ((event: Event) => void) | null = null
    const setupThemeListener = () => {
      if (state.terminal) {
        handleThemeUpdate = createThemeUpdateHandler(
          state.terminal,
          containerRef,
          state.webglAddonRef
        )
        window.addEventListener('terminal-theme-update', handleThemeUpdate)
      } else {
        // Terminal not ready yet, check again soon
        setTimeout(setupThemeListener, 100)
      }
    }
    setupThemeListener()

    // Cleanup
    return () => {
      if (handleThemeUpdate) {
        window.removeEventListener('terminal-theme-update', handleThemeUpdate)
      }
      cleanupTitle?.()
      cleanupPath?.()
      cleanupPid?.()
      cleanupRecreated?.()
      cleanupTerminal(containerRef, state, initCheckInterval, null, cleanupData, cleanupExit)
      setIsReady(false)
    }
  }, [ptyId])

  // Sync terminal theme when theme prop changes
  useEffect(() => {
    const cachedTheme = getLastTerminalTheme()
    console.log('[Terminal] useEffect[theme] fired, terminal:', !!terminalRef.current, 'cached:', !!cachedTheme, 'bg:', cachedTheme?.background)
    if (terminalRef.current && cachedTheme) {
      terminalRef.current.options.theme = cachedTheme
      // Force viewport background + repaint (WebGL addon workaround)
      const viewport = containerRef.current?.querySelector('.xterm-viewport') as HTMLElement
      if (viewport && cachedTheme.background) {
        viewport.style.backgroundColor = cachedTheme.background
      }
      terminalRef.current.refresh(0, terminalRef.current.rows - 1)
    }
  }, [theme])

  return {
    containerRef,
    terminalRef,
    fitAddonRef,
    userScrolledUpRef,
    currentLineInputRef,
    inputSuppressedRef,
    isReady,
  }
}
