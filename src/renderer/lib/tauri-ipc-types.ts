export interface TokenStatsResponse {
  totalInput: number;
  totalOutput: number;
  totalSaved: number;
  totalCost: number;
  [key: string]: unknown;
}

export interface ExtensionRegistryResponse {
  extensions: unknown[];
  [key: string]: unknown;
}

export interface ProjectScanResponse {
  projectPath: string;
  capabilities: unknown;
  [key: string]: unknown;
}

export interface InitializationProposalResponse {
  id: string;
  operations: unknown[];
  [key: string]: unknown;
}

export interface ProjectIntelligenceResponse {
  health: number;
  [key: string]: unknown;
}

export interface CheckToolResponse {
  installed: boolean;
  npmInstalled?: boolean;
  gitBashInstalled?: boolean;
  version?: string;
  path?: string;
  error?: string;
}

export interface VoiceCheckResponse {
  installed: boolean;
  engine?: string;
  error?: string;
}

export interface CommandResult {
  success: boolean;
  error?: string;
}

export interface JobProgressEvent {
  id: string;
  progress: number;
  message: string;
}

export interface JobStatusChangedEvent {
  id: string;
  status?: string;
}

export interface ActivityEvent {
  id?: number;
  event_type: string;
  source: string;
  message: string;
  metadata?: string;
  timestamp: string;
}

export interface RegisteredAgent {
  id: string;
  name: string;
  role: string;
  status: string;
  last_active?: string;
  model: string;
  provider: string;
  burn_rate: number;
  quality_score: number;
  queue_size: number;
  active_task?: string;
  evolution_confidence?: number;
  evolution_status?: string;
}

export interface AgentTask {
  id: string;
  agentId: string;
  title: string;
  description?: string;
  priority: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentTrace {
  id: string;
  agentId: string;
  taskId?: string;
  step_name: string;
  details?: string;
  status: string;
  duration_ms?: number;
  timestamp: string;
}

export interface InstalledExtensionResponse {
  id: string;
  name: string;
  description: string;
  type: 'skill' | 'mcp' | 'agent';
  installedAt: number;
  enabled: boolean;
  scope: 'global' | 'project';
  version?: string;
  repo?: string;
  npm?: string;
  commands?: string[];
  tags?: string[];
  configSchema?: Record<string, unknown>;
  projectPath?: string;
  config?: Record<string, unknown>;
}

export interface HealthStatusResponse {
  cpu_usage: number;
  memory_usage: number;
  total_memory: number;
  threads: number;
  status: string;
  services: Array<{
    id: string;
    name: string;
    status: string;
    detail: string;
    diagnostics: Array<{
      level: string;
      message: string;
      suggestion?: string;
      code?: string;
    }>;
  }>;
  installed_extensions: InstalledExtensionResponse[];
}

export interface DiagnosticBundleResponse {
  success?: boolean;
  path?: string;
  error?: string;
  [key: string]: unknown;
}

export interface AiProviderResponse {
  id: string;
  name?: string;
  [key: string]: unknown;
}

export interface AiModelResponse {
  id: string;
  name?: string;
  provider?: string;
  [key: string]: unknown;
}

export interface ProviderHealthResponse {
  isHealthy: boolean;
  lastError?: string;
  consecutiveFailures: number;
  lastFailureAt?: number;
}

export type AiHealthStatusResponse = Record<string, ProviderHealthResponse>;

export interface RtkOptimizationResponse {
  optimized?: string;
  savedTokens?: number;
  [key: string]: unknown;
}

export interface AgentMessage {
  id: string;
  timestamp: number;
  from_agent: string;
  to_agent?: string;
  message_type: 'finding' | 'request' | 'warning' | 'alert' | 'simulation';
  content: string;
  metadata?: unknown;
}

export interface SwarmSnapshotResponse {
  id: string;
  name?: string;
  projectPath?: string;
  handoffNotes?: string;
  [key: string]: unknown;
}
