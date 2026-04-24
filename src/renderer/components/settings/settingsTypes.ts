import type { Api } from '../../api/types'
import type { Theme } from '../../themes'
type WhisperModelSize = 'tiny.en' | 'base.en' | 'small.en' | 'medium.en' | 'large-v3'

// Whisper models available
export const WHISPER_MODELS: Array<{ value: WhisperModelSize; label: string; desc: string }> = [
  { value: 'tiny.en', label: 'Tiny (75MB)', desc: 'Fastest, basic accuracy' },
  { value: 'base.en', label: 'Base (147MB)', desc: 'Good balance' },
  { value: 'small.en', label: 'Small (488MB)', desc: 'Better accuracy' },
  { value: 'medium.en', label: 'Medium (1.5GB)', desc: 'High accuracy' },
  { value: 'large-v3', label: 'Large (3GB)', desc: 'Best accuracy, multilingual' },
]

// Piper voices available
export const PIPER_VOICES = [
  { value: 'en_US-libritts_r-medium', label: 'LibriTTS-R (US)', desc: 'Natural US English' },
  { value: 'en_GB-jenny_dioco-medium', label: 'Jenny (UK)', desc: 'British English' },
  { value: 'en_US-ryan-medium', label: 'Ryan (US)', desc: 'US English male' },
]

// Common tool patterns for quick selection
export const COMMON_TOOLS = [
  { label: 'Read files', value: 'Read' },
  { label: 'Write files', value: 'Write' },
  { label: 'Edit files', value: 'Edit' },
  { label: 'MultiEdit', value: 'MultiEdit' },
  { label: 'Grep search', value: 'Grep' },
  { label: 'Glob search', value: 'Glob' },
  { label: 'List dirs', value: 'LS' },
  { label: 'Web fetch', value: 'WebFetch' },
  { label: 'Web search', value: 'WebSearch' },
  { label: 'Questions', value: 'AskUserQuestion' },
  { label: 'Task agents', value: 'Task' },
  { label: 'Todo list', value: 'TodoWrite' },
  { label: 'Git commands', value: 'Bash(git:*)' },
  { label: 'npm commands', value: 'Bash(npm:*)' },
  { label: 'All Bash', value: 'Bash' },
]

// Permission modes available in Claude Code
export const PERMISSION_MODES = [
  { label: 'Default', value: 'default', desc: 'Ask for all permissions' },
  { label: 'Accept Edits', value: 'acceptEdits', desc: 'Auto-accept file edits' },
  { label: 'Plan', value: 'plan', desc: 'Require plan approval before actions' },
  { label: 'Auto', value: 'auto', desc: 'Automatic permission decisions' },
  { label: "Don't Ask", value: 'dontAsk', desc: 'Skip permission prompts' },
  { label: 'Bypass All', value: 'bypassPermissions', desc: 'Skip all permission checks' },
]

export const BACKEND_MODES = [
  { label: 'Default', value: 'default', desc: 'Use the global backend selection' },
  { label: 'Claude', value: 'claude', desc: 'Use Claude for code generation' },
  { label: 'Gemini', value: 'gemini', desc: 'Use Gemini for code generation' },
  { label: 'Codex', value: 'codex', desc: 'Use Codex for code generation' },
  { label: 'OpenCode', value: 'opencode', desc: 'Use OpenCode for code generation' },
  { label: 'Aider', value: 'aider', desc: 'Use Aider AI pair programmer' },
]

export interface ProviderHealth {
  isHealthy: boolean
  lastError?: string
  consecutiveFailures: number
  lastFailureAt?: number
}

export interface ProviderConfig {
  id: string
  name: string
  enabled: boolean
  apiKey?: string
  baseUrl?: string
  models: string[]
  defaultModel?: string
}

export interface ModelPlan {
  id: string
  name: string
  description: string
  plannerModel: string
  builderModel: string
  reviewerModel: string
  researcherModel: string
}

export interface AgentRoutingPolicy {
  role: string
  planId?: string
  modelOverride?: string
  providerOverride?: string
}

export interface AiRuntimeSettings {
  providers: ProviderConfig[]
  plans: ModelPlan[]
  routing: AgentRoutingPolicy[]
  activePlanId: string
  defaultStrategy: string
}

// Terminal ANSI colors customization
export interface TerminalColorsCustomization {
  black?: string
  red?: string
  green?: string
  yellow?: string
  blue?: string
  magenta?: string
  cyan?: string
  white?: string
}

// Theme customization options
export interface ThemeCustomization {
  accentColor: string | null
  backgroundColor: string | null
  textColor: string | null
  terminalColors: TerminalColorsCustomization | null
}

export const DEFAULT_THEME_CUSTOMIZATION: ThemeCustomization = {
  accentColor: null,
  backgroundColor: null,
  textColor: null,
  terminalColors: null
}

// Grouped state interfaces to reduce useState calls
export interface GeneralSettings {
  defaultProjectDir: string
  selectedTheme: string
  themeCustomization: ThemeCustomization
  autoAcceptTools: string[]
  permissionMode: string
  customTool: string
  backend: 'default' | 'claude' | 'gemini' | 'codex' | 'opencode' | 'aider'
  glowEnabled: boolean
  accentColor: string
  aiRuntime: AiRuntimeSettings
}

export interface VoiceSettings {
  whisperStatus: { installed: boolean; models: string[]; currentModel: string | null }
  ttsStatus: { installed: boolean; voices: string[]; currentVoice: string | null }
  selectedVoice: string
  selectedEngine: 'piper' | 'xtts' | 'tada'
  ttsSpeed: number
  installedVoices: Array<{ key: string; displayName: string; source: string }>
  tadaVoiceSample?: string | null
}

export interface XttsSettings {
  temperature: number
  topK: number
  topP: number
  repetitionPenalty: number
}

export interface UIState {
  installingModel: string | null
  installingVoice: string | null
  showVoiceBrowser: boolean
  playingPreview: string | null
  previewLoading: string | null
  removingTTS: boolean
  ttsRemovalResult: { success: number; failed: number } | null
}

// Default values for grouped state
export const DEFAULT_GENERAL: GeneralSettings = {
  defaultProjectDir: '',
  selectedTheme: 'default',
  themeCustomization: DEFAULT_THEME_CUSTOMIZATION,
  autoAcceptTools: [],
  permissionMode: 'default',
  customTool: '',
  backend: 'default',
  glowEnabled: true,
  accentColor: '#3b82f6',
  aiRuntime: {
    providers: [
      { id: 'claude', name: 'Anthropic Claude', enabled: true, models: ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3-haiku'], defaultModel: 'claude-3-5-sonnet' },
      { id: 'gemini', name: 'Google Gemini', enabled: true, models: ['gemini-1.5-pro', 'gemini-1.5-flash'], defaultModel: 'gemini-1.5-pro' },
      { id: 'openai', name: 'OpenAI / Codex', enabled: false, models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'], defaultModel: 'gpt-4o' },
      { id: 'ollama', name: 'Local Ollama', enabled: false, models: ['llama3', 'codellama', 'mistral', 'phi3'], defaultModel: 'llama3' },
    ],
    plans: [
      {
        id: 'balanced',
        name: 'Balanced',
        description: 'Optimal mix of speed and intelligence.',
        plannerModel: 'claude-3-5-sonnet',
        builderModel: 'claude-3-5-sonnet',
        reviewerModel: 'claude-3-5-sonnet',
        researcherModel: 'gemini-1.5-flash'
      },
      {
        id: 'budget',
        name: 'Budget',
        description: 'Lowest cost, suitable for simple tasks.',
        plannerModel: 'claude-3-haiku',
        builderModel: 'claude-3-haiku',
        reviewerModel: 'claude-3-haiku',
        researcherModel: 'gemini-1.5-flash'
      }
    ],
    routing: [
      { role: 'planner', planId: 'balanced' },
      { role: 'builder', planId: 'balanced' },
      { role: 'reviewer', planId: 'balanced' },
      { role: 'researcher', planId: 'balanced' },
    ],
    activePlanId: 'balanced',
    defaultStrategy: 'quality'
  }
}

export const DEFAULT_VOICE: VoiceSettings = {
  whisperStatus: { installed: false, models: [], currentModel: null },
  ttsStatus: { installed: false, voices: [], currentVoice: null },
  selectedVoice: 'en_US-libritts_r-medium',
  selectedEngine: 'piper',
  ttsSpeed: 1.0,
  installedVoices: [],
  tadaVoiceSample: null
}

export const DEFAULT_XTTS: XttsSettings = {
  temperature: 0.65,
  topK: 50,
  topP: 0.85,
  repetitionPenalty: 2.0
}

export const DEFAULT_UI: UIState = {
  installingModel: null,
  installingVoice: null,
  showVoiceBrowser: false,
  playingPreview: null,
  previewLoading: null,
  removingTTS: false,
  ttsRemovalResult: null
}

export const UPDATE_STATUS_TYPES = ['idle', 'checking', 'available', 'downloading', 'downloaded', 'error'] as const
export type UpdateStatusType = typeof UPDATE_STATUS_TYPES[number]

export interface UpdateStatus {
  status: UpdateStatusType
  version?: string
  progress?: number
  error?: string
}

export interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onThemeChange: (theme: Theme) => void
  onSaved?: (settings: { defaultProjectDir: string; theme: string; themeCustomization?: ThemeCustomization; autoAcceptTools?: string[]; permissionMode?: string; backend?: 'default' | 'claude' | 'gemini' | 'codex' | 'opencode' | 'aider' }) => void
  appVersion?: string
  updateStatus?: UpdateStatus
  onDownloadUpdate?: () => void
  onInstallUpdate?: () => void
  projectPath: string | null
  focusedTabPtyId: string | null
  onOpenSession: (path: string, sessionId?: string, ptyId?: string, prompt?: string, forceNew?: boolean) => void
  initialCategory?: string
  api: Api
}

