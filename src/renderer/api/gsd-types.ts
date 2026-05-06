import type { DynamicApiValue } from './dynamic-types';

// ============================================================================
// Orchestration & Approval Types
// ============================================================================

export type ApprovalCategory =
  | 'file_change'
  | 'command'
  | 'config_change'
  | 'destructive'
  | 'external';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface FileDiff {
  path: string;
  hunks: Array<{
    oldStart: number;
    newStart: number;
    lines: string[];
  }>;
  isNew?: boolean;
  isDeleted?: boolean;
}

export interface ApprovalRequest {
  id: string;
  agentId: string;
  agentName: string;
  category: ApprovalCategory;
  risk: RiskLevel;
  title: string;
  description: string;
  fileDiffs?: FileDiff[];
  command?: string;
  affectedPaths?: string[];
  reversible: boolean;
  timestamp: number;
  expiresAt?: number;
}

export interface ApprovalResponse {
  actionId: string;
  decision: 'approved' | 'rejected' | 'modified';
  comment?: string;
  conditions?: string[];
}

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type UnknownRecord = Record<string, unknown>;

export interface ExtensionDescriptor {
  id: string;
  name: string;
  type: string;
  description: string;
  version?: string;
  enabled?: boolean;
  scope?: string;
  projectPath?: string;
  config?: object;
}

export interface ExtensionRegistry {
  skills?: ExtensionDescriptor[];
  mcps?: ExtensionDescriptor[];
  agents?: ExtensionDescriptor[];
  [key: string]: unknown;
}

export interface McpToolListResponse {
  tools?: Array<{
    name: string;
    description?: string;
    inputSchema?: object;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface McpResourceListResponse {
  resources?: Array<{
    uri: string;
    name?: string;
    description?: string;
    mimeType?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface KspecDispatchStatus {
  running: boolean;
  pid?: number;
  startedAt?: string;
  error?: string;
  [key: string]: unknown;
}

export interface BeadsTask {
  id: string;
  title?: string;
  status?: string;
  priority?: number;
  issue_type?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  acceptance_criteria?: string;
  [key: string]: unknown;
}

export interface BeadsResult {
  success: boolean;
  task?: BeadsTask;
  tasks?: BeadsTask[];
  error?: string;
  [key: string]: unknown;
}

export type ToolArguments = JsonValue | UnknownRecord;

export interface AudioPreviewResult {
  success: boolean;
  audioData?: string;
  error?: string;
}

// ============================================================================
// GSD Engine Types
// ============================================================================

export type GsdStepStatus =
  | 'Pending'
  | 'InProgress'
  | 'Completed'
  | { Failed: string }
  | 'Skipped'
  | { WaitingForUser: string }
  | { AutoFixing: string }
  | { AwaitingFixApproval: [string, string] }
  | { Conflict: [string, string, string] }
  | { AwaitingDelegationApproval: [string, string] };

export type UserResponse =
  | 'Approve'
  | 'ApproveFix'
  | 'ResolveR1'
  | 'ResolveR2'
  | 'ApproveDelegation'
  | 'RejectDelegation'
  | 'Retry'
  | 'Abort';

export interface GsdStep {
  id: string;
  title: string;
  description: string;
  status: GsdStepStatus;
  result?: string;
  attempts: number;
  maxRetries: number;
  waveIndex?: number;
  startedAt?: number;
  completedAt?: number;
}

export interface GsdPhase {
  id: string;
  title: string;
  steps: GsdStep[];
  status: GsdStepStatus;
  startedAt?: number;
  completedAt?: number;
}

export interface GsdPlan {
  id: string;
  title: string;
  taskId: string;
  phases: GsdPhase[];
  metadata: Record<string, string>;
}

export interface GsdExecutionEvent {
  planId: string;
  phaseId?: string;
  stepId?: string;
  eventType: string;
  message: string;
  timestamp: number;
}

export interface McpServerConfig {
  name: string;
  command?: string;
  args: string[];
  env: Record<string, string>;
  url?: string;
}

export interface GsdApprovalRequest {
  approvalId: string;
  stepId: string;
  tool: string;
  arguments: DynamicApiValue;
  reason: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
}

export interface ToolInfo {
  name: string;
  description: string;
  category: string;
  usageCount: number;
  usage_count?: number;
  successRate: number;
  parametersSchema: string;
  is_enabled?: boolean;
  version?: string;
  avg_latency_ms?: number;
}

export interface DiagnosticResult {
  bundle_path: string;
  created_at: string;
}
