import type { DynamicApiValue } from './dynamic-types';

export interface AgentAction {
  id: string;
  agentId: string;
  agentName: string;
  type:
    | 'thought'
    | 'command'
    | 'file_change'
    | 'approval_request'
    | 'error'
    | 'success';
  message: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface AgentStatus {
  id: string;
  name: string;
  role?: string;
  status: 'idle' | 'busy' | 'blocked' | 'error';
  currentTask?: string;
  progress?: number;
  lastAction?: string;
  worktree?: string;
  metrics?: {
    tasksCompleted: number;
    uptime: number;
    memoryUsage?: number;
  };
}

export interface SystemTelemetry {
  cpu: number;
  memory: number;
  activeJobs: number;
  uptime: number;
  health: 'healthy' | 'warning' | 'degraded';
}

export interface SwarmSnapshot {
  id: string;
  project_path: string;
  name: string;
  commit_sha?: string;
  snapshot_path: string;
  worktree_path?: string;
  timestamp: number;
  handoff_notes?: string;
}

export interface AgentMetricsPayload {
  burn_rate?: number;
  quality_score?: number;
  error_rate?: number;
  queue_size?: number;
  active_task?: string;
  evolution_confidence?: number;
  evolution_status?: string;
  [key: string]: unknown;
}

export interface AiLearningPayload {
  eventType: string;
  payload: DynamicApiValue;
}

export interface SwarmKnowledge {
  id: number;
  pattern_type: string;
  pattern_key: string;
  content: string;
  metadata?: string;
  rank?: number;
}

export type InsightSeverity = 'high' | 'medium' | 'low';

export type InsightType =
  | 'technical'
  | 'architectural'
  | 'optimization'
  | 'learning';

export interface NeuralInsight {
  id: string;
  severity: InsightSeverity;
  insightType: InsightType;
  message: string;
  details?: string;
  actionLabel?: string;
  actionCommand?: string;
  timestamp: number;
}

export interface DistributedNode {
  id: string;
  name: string;
  ip: string;
  port: number;
  nodeType: string;
  status: string;
  lastSeen: number;
  capabilities: string[];
  creditBalance: number;
  utilization: number;
  bidFloorCredits: number;
  lastBidCredits: number;
}

export interface RemoteToolBid {
  nodeId: string;
  nodeName: string;
  capability: string;
  bidCredits: number;
  availableCredits: number;
  utilization: number;
  reason: string;
}

export interface SwarmPersona {
  id: string;
  name: string;
  role: string;
  expertise: string[];
  tools: string[];
  governanceTier: string;
}

export interface SwarmPolicy {
  version: string;
  metadata: {
    name: string;
    id: string;
  };
  defaultMode: 'permissive' | 'watchful' | 'strict' | 'locked';
  rules: {
    selector: { tool: string };
    permissions: {
      permissionType: 'allow' | 'require_approval' | 'deny';
      patterns: string[];
      message?: string;
    }[];
  }[];
  personas: SwarmPersona[];
}
