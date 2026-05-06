import type { DynamicApiValue } from './dynamic-types';
import type { BackendId, BackendSelection } from './terminal-types';

// ============================================================================
// Data Types
// ============================================================================

/**
 * Terminal ANSI colors customization
 */
export interface TerminalColorsCustomization {
  black?: string;
  red?: string;
  green?: string;
  yellow?: string;
  blue?: string;
  magenta?: string;
  cyan?: string;
  white?: string;
}

/**
 * Theme customization settings
 */
export interface ThemeCustomization {
  accentColor: string | null;
  backgroundColor: string | null;
  textColor: string | null;
  terminalColors: TerminalColorsCustomization | null;
}

/**
 * Application settings
 */
export interface Settings {
  defaultProjectDir: string;
  theme: string;
  themeCustomization?: ThemeCustomization | null;
  aiRuntime?: DynamicApiValue;
  voiceOutputEnabled?: boolean;
  voiceVolume?: number;
  voiceSpeed?: number;
  voiceSkipOnNew?: boolean;
  voiceSilenceThreshold?: number;
  voicePushToTalk?: boolean;
  voiceAutoListen?: boolean;
  autoAcceptTools?: string[];
  permissionMode?: string;
  backend?: BackendSelection;
  terminal?: {
    fontSize: number;
    fontFamily: string;
    cursorStyle: 'block' | 'underline' | 'bar';
    cursorBlink: boolean;
    theme: string;
    opacity: number;
    lineHeight: number;
    letterSpacing: number;
    padding: number;
  };
}

/**
 * Project category for organizing projects in the sidebar
 */
export interface ProjectCategory {
  id: string;
  name: string;
  collapsed: boolean;
  order: number;
}

/**
 * Project configuration
 */
export interface Project {
  path: string;
  name: string;
  executable?: string;
  apiPort?: number;
  apiAutoStart?: boolean;
  apiSessionMode?: 'existing' | 'new-keep' | 'new-close';
  apiModel?: 'default' | 'opus' | 'sonnet' | 'haiku';
  autoAcceptTools?: string[];
  permissionMode?: string;
  color?: string;
  ttsVoice?: string;
  ttsEngine?: 'piper' | 'xtts';
  backend?: 'default' | BackendId;
  categoryId?: string;
  order?: number;
}

/**
 * Open tab representing an active terminal session
 */
export interface OpenTab {
  id: string;
  projectPath: string;
  sessionId?: string;
  title: string;
  customTitle?: boolean;
  ptyId: string;
  backend?: BackendSelection;
}

/**
 * Tile layout configuration for tiled view mode
 */
export interface TileLayout {
  id: string;
  tabIds: string[];
  activeTabId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Workspace state containing all projects, tabs, and layout
 */
export interface Workspace {
  projects: Project[];
  openTabs: OpenTab[];
  activeTabId: string | null;
  viewMode?: 'tabs' | 'tiled';
  tileLayout?: TileLayout[];
  tileTree?: TileTreeNode;
  categories: ProjectCategory[];
}

/**
 * Voice settings configuration
 */
export interface VoiceSettings {
  whisperModel?: string;
  ttsEngine?: 'piper' | 'xtts' | 'openvoice';
  ttsVoice?: string;
}

export interface UpdateNotice {
  id: string;
  currentVersion: string;
  latestVersion: string;
  name: string;
  type: string;
}

export interface AiRuntimeSettingsPayload {
  providers: object[];
  plans: object[];
  routing: object[];
  activePlanId?: string;
  defaultStrategy?: string;
  [key: string]: unknown;
}

export interface TileTreeLeaf {
  type: 'leaf';
  id: string;
  tabIds: string[];
  activeTabId: string;
}

export interface TileTreeBranch {
  type: 'branch';
  id: string;
  direction: 'horizontal' | 'vertical';
  children: TileTreeNode[];
  ratios: number[];
}

export type TileTreeNode = TileTreeLeaf | TileTreeBranch;

export interface VoiceCatalogEntry {
  key: string;
  name: string;
  language: {
    code: string;
    name_english: string;
    country_english: string;
  };
  quality: string;
  num_speakers: number;
  files: Record<string, { size_bytes: number }>;
  [key: string]: unknown;
}

export interface InstalledVoice {
  key: string;
  id?: string;
  name?: string;
  displayName: string;
  source: string;
  quality?: string;
  language?: string;
  [key: string]: unknown;
}

export interface VoiceSettingsPayload {
  ttsVoice?: string;
  ttsEngine?: string;
  ttsSpeed?: number;
  xttsTemperature?: number;
  xttsTopK?: number;
  xttsTopP?: number;
  xttsRepetitionPenalty?: number;
  tadaVoiceSample?: string | null;
  [key: string]: unknown;
}

export interface XttsVoice {
  id: string;
  name: string;
  language: string;
  createdAt?: number;
  [key: string]: unknown;
}

export interface XttsSampleVoice extends XttsVoice {
  file: string;
  installed: boolean;
}
