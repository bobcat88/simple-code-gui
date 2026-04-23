import React, { useEffect, useState, useCallback, useRef } from 'react'
import '@xterm/xterm/css/xterm.css'
import { FloatingInput } from '../FloatingInput.js'
import { AutoWorkOptions } from '../TerminalMenu.js'
import { CustomCommandModal } from '../CustomCommandModal.js'
import { resolveBackendCommand } from '../../utils/backendCommands.js'
import { cn } from '../../lib/utils'
import type { TerminalProps } from './types.js'
import { ExtendedApi } from '../../api/types.js'
import { useTerminalSetup } from './useTerminalSetup.js'
import { useTTS } from './useTTS.js'
import { useAutoWork } from './useAutoWork.js'
import { useSummaryCapture } from './useSummaryCapture.js'
import { useTokenMeter } from './useTokenMeter.js'
import { TokenBudgetHud } from './TokenBudgetHud.js'
import { clearTerminalBuffer, cleanupOrphanedBuffers, formatPathsForBackend } from './utils.js'
import { useApi } from '../../contexts/ApiContext'

// Re-export buffer utilities for external use
export { clearTerminalBuffer, cleanupOrphanedBuffers }

/**
 * Terminal component that wraps xterm.js with PTY integration.
 * Supports TTS, auto work loop, summary capture, and backend-specific commands.
 */
export function Terminal({ 
  ptyId, 
  isActive, 
  theme, 
  onFocus, 
  projectPath, 
  backend, 
  api: propApi, 
  isMobile, 
  onOpenFileBrowser, 
  isTiled,
  onTerminalTitle,
  onTerminalPath,
  onProcessId,
  onSessionEnded,
  terminalSettings
}: TerminalProps): React.ReactElement {
  const contextApi = useApi()
  const api = propApi || contextApi
  // Custom command modal state
  const [showCustomCommandModal, setShowCustomCommandModal] = useState(false)
  const [autoAccept, setAutoAccept] = useState(false)

  // Sync auto-accept state when PTY changes
  useEffect(() => {
    if (api && api.getAutoAcceptStatus) {
      api.getAutoAcceptStatus(ptyId).then((enabled: boolean) => {
        setAutoAccept(enabled)
      })
    }
  }, [ptyId, api])

  const handleToggleAutoAccept = useCallback(() => {
    const newState = !autoAccept
    setAutoAccept(newState)
    if (api && api.setAutoAccept) {
      api.setAutoAccept(ptyId, newState)
    }
  }, [autoAccept, ptyId, api])

  // PTY write helper - uses dependency-injected api instance
  const writePty = useCallback((id: string, data: string) => {
    api?.writePty(id, data)
  }, [api])

  // Backend change handler
  const handleBackendChange = useCallback((newBackend: 'default' | 'claude' | 'gemini' | 'codex' | 'opencode' | 'aider') => {
    if (newBackend === 'default') return
    api?.setPtyBackend?.(ptyId, newBackend)
  }, [api, ptyId])

  // Send backend-specific command
  const sendBackendCommand = useCallback((commandId: string): boolean => {
    const backendCommand = resolveBackendCommand(backend, commandId)
    if (!backendCommand) {
      return false
    }
    writePty(ptyId, backendCommand)
    setTimeout(() => {
      writePty(ptyId, '\r')
    }, 100)
    return true
  }, [backend, ptyId, writePty])

  // TTS hook
  const {
    processTTSChunk,
    handleUserInput,
    resetTTSState,
    prePopulateSpokenContent,
  } = useTTS({ ptyId, isActive })

  // Auto work hook (needs summary capture's triggerSummarize)
  // We'll wire it up after summary capture is created
  const autoWorkHookPlaceholder = useAutoWork({
    ptyId,
    sendBackendCommand,
    triggerSummarize: () => {}, // Will be replaced
  })

  // Summary capture hook
  const {
    processSummaryChunk,
    triggerSummarize,
  } = useSummaryCapture({
    ptyId,
    sendBackendCommand,
    autoWorkWithSummary: autoWorkHookPlaceholder.autoWorkState.withSummary,
    buildAutoWorkPrompt: autoWorkHookPlaceholder.buildAutoWorkPrompt,
  })

  // Reconnect auto work with actual triggerSummarize
  const {
    autoWorkState,
    awaitingUserReview,
    handleAutoWorkMarker,
    startAutoWork,
    continueAutoWork,
    stopAutoWork,
    cancelAutoWork,
  } = useAutoWork({
    ptyId,
    sendBackendCommand,
    triggerSummarize,
  })

  // Token meter hook
  const { processTokenChunk, snapshot: tokenSnapshot } = useTokenMeter({
    ptyId,
    api,
    projectPath: projectPath || undefined,
    backend
  })

  // Terminal setup hook
  const {
    containerRef,
    terminalRef,
    fitAddonRef,
    userScrolledUpRef,
    currentLineInputRef,
    inputSuppressedRef,
    isReady,
  } = useTerminalSetup({
    ptyId,
    theme,
    backend,
    api,
    onTTSChunk: processTTSChunk,
    onUserInput: handleUserInput,
    onSummaryChunk: processSummaryChunk,
    onAutoWorkMarker: handleAutoWorkMarker,
    onTokenChunk: processTokenChunk,
    onTerminalTitle,
    onTerminalPath,
    onProcessId,
    onSessionEnded,
    prePopulateSpokenContent,
    resetTTSState,
  })

  // Refit when tab becomes active
  useEffect(() => {
    if (isActive && fitAddonRef.current && containerRef.current && terminalRef.current) {
      const doFit = () => {
        if (!fitAddonRef.current || !containerRef.current || !terminalRef.current) return

        const rect = containerRef.current.getBoundingClientRect()
        if (rect.width > 50 && rect.height > 50) {
          const wasAtBottom = !userScrolledUpRef.current

          fitAddonRef.current.fit()
          const dims = fitAddonRef.current.proposeDimensions()
          if (dims && dims.cols > 0 && dims.rows > 0) {
            api?.resizePty(ptyId, dims.cols, dims.rows)
          }
          if (wasAtBottom) {
            requestAnimationFrame(() => {
              terminalRef.current?.scrollToBottom()
            })
          }
        }
        terminalRef.current?.focus()
      }

      requestAnimationFrame(doFit)
      setTimeout(doFit, 50)
      setTimeout(doFit, 150)
    }
  }, [isActive, isReady, ptyId, containerRef, terminalRef, fitAddonRef, userScrolledUpRef])

  // Check if a drag event is a tile/sidebar/sub-tab drag (not a file drop)
  const isTileDrag = useCallback((e: React.DragEvent) => {
    const types = e.dataTransfer.types
    return types.includes('application/x-sidebar-project') ||
           types.includes('application/x-subtab') ||
           // text/plain without Files = tile drag; text/plain with Files = file manager drag
           (types.includes('text/plain') && !types.includes('Files') && !types.includes('text/uri-list'))
  }, [])

  // Handle file drop from file manager (let tile/sidebar drags pass through to parent handlers)
  const handleDrop = useCallback((e: React.DragEvent) => {
    if (isTileDrag(e)) return // Let tile/sidebar drags bubble to tiled view handlers

    e.preventDefault()
    e.stopPropagation()

    const paths: string[] = []

    // Try Files array first (KDE Dolphin uses this)
    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        try {
          const filePath = (api as ExtendedApi)?.getPathForFile?.(files[i])
          if (filePath) {
            paths.push(filePath)
          }
        } catch {
          // getPathForFile not available
        }
      }
    }

    // Fallback: text/uri-list
    if (paths.length === 0) {
      const uriList = e.dataTransfer?.getData('text/uri-list')
      if (uriList) {
        uriList.split('\n')
          .map(uri => uri.trim())
          .filter(uri => uri.startsWith('file://'))
          .forEach(uri => {
            paths.push(decodeURIComponent(uri.replace('file://', '')))
          })
      }
    }

    if (paths.length > 0) {
      api?.writePty(ptyId, formatPathsForBackend(paths, backend))
    }
  }, [ptyId, backend, isTileDrag])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (isTileDrag(e)) return // Let tile/sidebar drags bubble to tiled view handlers

    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }, [isTileDrag])

  // Track if a clear/compact operation is in progress to prevent double-triggering
  const clearInProgressRef = useRef(false)

  // Special handlers for /clear and /compact that preserve user input
  const handleClearWithRestore = useCallback(() => {
    // Debounce: prevent multiple rapid triggers
    if (clearInProgressRef.current) return
    clearInProgressRef.current = true

    const savedInput = currentLineInputRef.current

    // Suppress user keyboard input to prevent race conditions
    inputSuppressedRef.current = true

    // Always send Ctrl+C to cancel any input (works for multiline too)
    writePty(ptyId, '\x03')
    currentLineInputRef.current = ''

    // Send /clear command
    const backendCommand = resolveBackendCommand(backend, 'clear')
    if (backendCommand) {
      setTimeout(() => {
        writePty(ptyId, backendCommand)
        setTimeout(() => {
          writePty(ptyId, '\r')
          // Restore input after command processes
          if (savedInput) {
            setTimeout(() => {
              writePty(ptyId, savedInput)
              currentLineInputRef.current = savedInput
              // Re-enable input and allow next operation
              setTimeout(() => {
                inputSuppressedRef.current = false
                clearInProgressRef.current = false
              }, 100)
            }, 500) // Wait for /clear to complete
          } else {
            setTimeout(() => {
              inputSuppressedRef.current = false
              clearInProgressRef.current = false
            }, 500)
          }
        }, 100)
      }, 300) // Wait for Ctrl+C to process and show fresh prompt
    } else {
      inputSuppressedRef.current = false
      clearInProgressRef.current = false
    }
  }, [backend, ptyId, writePty, currentLineInputRef, inputSuppressedRef])

  const handleCompactWithRestore = useCallback(() => {
    // Debounce: prevent multiple rapid triggers
    if (clearInProgressRef.current) return
    clearInProgressRef.current = true

    const savedInput = currentLineInputRef.current

    // Suppress user keyboard input to prevent race conditions
    inputSuppressedRef.current = true

    // Always send Ctrl+C to cancel any input (works for multiline too)
    writePty(ptyId, '\x03')
    currentLineInputRef.current = ''

    // Send /compact command
    const backendCommand = resolveBackendCommand(backend, 'compact')
    if (backendCommand) {
      setTimeout(() => {
        writePty(ptyId, backendCommand)
        setTimeout(() => {
          writePty(ptyId, '\r')
          // Restore input after command processes
          if (savedInput) {
            setTimeout(() => {
              writePty(ptyId, savedInput)
              currentLineInputRef.current = savedInput
              // Re-enable input and allow next operation
              setTimeout(() => {
                inputSuppressedRef.current = false
                clearInProgressRef.current = false
              }, 100)
            }, 500) // Wait for /compact to complete
          } else {
            setTimeout(() => {
              inputSuppressedRef.current = false
              clearInProgressRef.current = false
            }, 500)
          }
        }, 100)
      }, 300) // Wait for Ctrl+C to process and show fresh prompt
    } else {
      inputSuppressedRef.current = false
      clearInProgressRef.current = false
    }
  }, [backend, ptyId, writePty, currentLineInputRef, inputSuppressedRef])

  // Handle menu commands
  const handleMenuCommand = useCallback((command: string, options?: AutoWorkOptions) => {
    // Route clear/compact to special handlers that preserve user input
    if (command === 'clear') {
      handleClearWithRestore()
      return
    }
    if (command === 'compact') {
      handleCompactWithRestore()
      return
    }

    if (sendBackendCommand(command)) {
      return
    }

    switch (command) {
      case 'summarize':
        triggerSummarize()
        break

      case 'autowork':
        startAutoWork(options)
        break

      case 'continuework':
        continueAutoWork()
        break

      case 'stopwork':
        stopAutoWork()
        break

      case 'cancel':
        cancelAutoWork()
        break

      case 'addcommand':
        setShowCustomCommandModal(true)
        break
    }
  }, [sendBackendCommand, triggerSummarize, startAutoWork, continueAutoWork, stopAutoWork, cancelAutoWork, handleClearWithRestore, handleCompactWithRestore])

  return (
    <div className="terminal-content-wrapper flex flex-col h-full overflow-hidden bg-background">
      <div className="flex-1 overflow-hidden relative">
        <div className="pointer-events-none absolute right-4 top-4 z-20 flex max-w-[calc(100%-2rem)] justify-end">
          <TokenBudgetHud
            snapshot={tokenSnapshot}
            className={cn(!isActive && 'opacity-50')}
          />
        </div>
        <div className={cn(
          "h-full",
          isTiled ? "p-2" : "max-w-5xl mx-auto px-4 md:px-8 py-4 pb-32"
        )}>
          <div
            ref={containerRef}
            className="terminal-xterm h-full w-full rounded-xl overflow-hidden border border-border/30 bg-black/20 backdrop-blur-sm shadow-inner"
            onMouseDown={onFocus}
            onClick={() => {
              // Focus terminal on click (important for mobile touch)
              terminalRef.current?.focus()
            }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          />
        </div>
        
        <FloatingInput 
          onInput={(data) => writePty(ptyId, data)}
          currentBackend={backend || 'claude'}
          onBackendChange={handleBackendChange}
          autoAccept={autoAccept}
          onToggleAutoAccept={handleToggleAutoAccept}
          isMobile={isMobile}
          activeTabId={ptyId}
        />
      </div>

      <CustomCommandModal
        isOpen={showCustomCommandModal}
        onClose={() => setShowCustomCommandModal(false)}
        projectPath={projectPath || null}
      />
    </div>
  )
}
