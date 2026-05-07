// ============================================================================
// Connection State Types
// ============================================================================

/**
 * Connection state for HTTP backend
 */
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

/**
 * Type of API backend being used
 */
export type ApiBackendType = 'electron' | 'http';

/**
 * Session discovery result
 */
export interface Session {
  sessionId: string;
  slug: string;
}

// ============================================================================
// API Interface
// ============================================================================

export type Unsubscribe = () => void;

export type PtyDataCallback = (data: string | Uint8Array) => void;

export type PtyExitCallback = (code: number) => void;

export type PtyRecreatedCallback = (data: {
  oldId: string;
  newId: string;
  backend: BackendId;
}) => void;

export type BackendId = 'claude' | 'gemini' | 'codex' | 'opencode' | 'aider';

export type BackendSelection = 'default' | BackendId;

export interface ApiOpenSessionEvent {
  projectPath: string;
  autoClose?: boolean;
  model?: string;
}

export type ApiOpenSessionCallback = (event: ApiOpenSessionEvent) => void;
