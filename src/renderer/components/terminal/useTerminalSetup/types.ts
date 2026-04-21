import type { MutableRefObject, RefObject } from 'react'
import type { Terminal as XTerm } from '@xterm/xterm'
import type { FitAddon } from '@xterm/addon-fit'
import type { Theme } from '../../../themes.js'
import type { Api } from '../../../api/types.js'

export interface UseTerminalSetupOptions {
  ptyId: string
  theme: Theme
  backend?: 'default' | 'claude' | 'gemini' | 'codex' | 'opencode' | 'aider'
  api?: Api  // API abstraction (uses window.electronAPI if not provided)
  onTTSChunk: (cleanChunk: string) => void
  onUserInput: (data: string) => void
  onSummaryChunk: (cleanChunk: string) => void
  onAutoWorkMarker: (cleanChunk: string) => void
  onTokenChunk: (cleanChunk: string) => void
  onTerminalTitle?: (title: string) => void
  onTerminalPath?: (path: string) => void
  onProcessId?: (pid: string) => void
  onSessionEnded?: () => void
  prePopulateSpokenContent: (chunks: string[]) => void
  resetTTSState: () => void
}

export interface UseTerminalSetupReturn {
  containerRef: RefObject<HTMLDivElement>
  terminalRef: MutableRefObject<XTerm | null>
  fitAddonRef: MutableRefObject<FitAddon | null>
  userScrolledUpRef: MutableRefObject<boolean>
  currentLineInputRef: MutableRefObject<string>
  inputSuppressedRef: MutableRefObject<boolean>
  isReady: boolean
}

export interface PtyOperations {
  writePty: (id: string, data: string) => void
  resizePty: (id: string, cols: number, rows: number) => void
  onPtyData: (id: string, callback: (data: string) => void) => (() => void) | undefined
  onPtyExit: (id: string, callback: (code: number) => void) => (() => void) | undefined
  onPtyTitle?: (id: string, callback: (title: string) => void) => (() => void) | undefined
  onPtyPath?: (id: string, callback: (path: string) => void) => (() => void) | undefined
  onPtyPid?: (id: string, callback: (pid: string) => void) => (() => void) | undefined
}

export interface TerminalRefs {
  containerRef: MutableRefObject<HTMLDivElement>
  terminalRef: MutableRefObject<XTerm | null>
  fitAddonRef: MutableRefObject<FitAddon | null>
  userScrolledUpRef: MutableRefObject<boolean>
  currentLineInputRef: MutableRefObject<string>
  inputSuppressedRef: MutableRefObject<boolean>
}
