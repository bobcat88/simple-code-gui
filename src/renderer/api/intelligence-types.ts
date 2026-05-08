import type { BackendId } from './terminal-types';

export interface TokenTransactionInput {
  sessionId: string;
  projectPath: string;
  backend: BackendId;
  inputTokens: number;
  outputTokens: number;
  costEstimate: number;
  nexusSessionId?: string;
  timestamp?: string;
}

export interface TokenHistoryFilters {
  startDate?: string;
  endDate?: string;
  projectPath?: string;
  backend?: BackendId;
  sessionId?: string;
  nexusSessionId?: string;
}

export interface TokenHistoryTotals {
  inputTokens: number;
  outputTokens: number;
  costEstimate: number;
  transactionCount: number;
}

export interface TokenHistorySession {
  sessionId: string;
  projectPath: string;
  backend: BackendId;
  inputTokens: number;
  outputTokens: number;
  costEstimate: number;
  firstTimestamp: string;
  lastTimestamp: string;
  transactionCount: number;
}

export interface TokenHistoryBreakdown {
  key: string;
  inputTokens: number;
  outputTokens: number;
  costEstimate: number;
}

export interface TokenHistoryPoint {
  date: string;
  inputTokens: number;
  outputTokens: number;
  costEstimate: number;
}

export interface TokenHistoryResponse {
  totals: TokenHistoryTotals;
  sessions: TokenHistorySession[];
  projectBreakdown: TokenHistoryBreakdown[];
  backendBreakdown: TokenHistoryBreakdown[];
  daily: TokenHistoryPoint[];
}

export interface OptimizationStats {
  provider?: string | null;
  rawTokens: number;
  optimizedTokens: number;
  savedTokens: number;
  cacheHits: number;
  cacheMisses: number;
  compressions: number;
  reasoningRequests: number;
  fimRequests: number;
  transactionCount: number;
  semanticHits: number;
  semanticMisses: number;
}

export interface OptimizationStatsResponse {
  aggregate: OptimizationStats;
  session: OptimizationStats;
  providerBreakdown: OptimizationStats[];
}

// ============================================================================
// Vector Engine Types
// ============================================================================

export interface VectorChunk {
  id: string;
  symbolName: string;
  projectPath: string;
  filePath: string;
  content: string;
  metadata: Record<string, string>;
  embedding?: number[];
}

export interface GsdSeed {
  id: string;
  title: string;
  slug: string;
  why: string;
  whenToSurface: string;
  status:
    | 'planted'
    | 'sprouted'
    | 'archived'
    | 'promoted_to_draft'
    | 'promoted_to_task';
  timestamp: number;
  createdAt?: string;
}

export interface KSpecDraft {
  id: string;
  title: string;
  content: string;
  lastModified: number;
  moduleId?: string;
  updatedAt?: number;
}

export interface BrainstormCanvas {
  nodes: BrainstormCanvasNode[];
  edges: BrainstormCanvasEdge[];
  updatedAt?: number;
}

export interface BrainstormCanvasNode {
  id: string;
  nodeType: 'seed' | 'draft' | 'sketch' | 'review';
  title: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sourceId?: string;
}

export interface BrainstormCanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  label?: string;
}

export interface VectorIndexStatus {
  totalChunks: number;
  indexedChunks: number;
  isIndexing: boolean;
  lastUpdated: number;
}

export interface VectorSearchResult {
  chunk: VectorChunk;
  score: number;
}

export interface DiscoveryResult {
  model_id: string;
  provider_name: string;
  new_quality_score: number;
  confidence: number;
}

// ============================================================================
// Project Wizard Types
// ============================================================================

export interface ScanOptions {
  includeCliHealth?: boolean;
  includeGitHealth?: boolean;
  maxDepth?: number;
}

export type SourceSystem =
  | 'simple_code_gui'
  | 'beads'
  | 'kspec'
  | 'gsd'
  | 'rtk'
  | 'gitnexus'
  | 'mcp'
  | 'provider'
  | 'git'
  | 'terminal'
  | 'user';

export type CapabilityKind =
  | 'task_backend'
  | 'spec_backend'
  | 'execution_workflow'
  | 'repo_intelligence'
  | 'token_optimizer'
  | 'mcp_server'
  | 'provider'
  | 'voice'
  | 'updater'
  | 'project_contract';

export type CapabilityMode =
  | 'full'
  | 'partial'
  | 'instruction_only'
  | 'degraded'
  | 'disabled'
  | 'unknown';

export type HealthStatus = 'healthy' | 'warning' | 'error' | 'unknown';

export type MarkerKind =
  | 'file'
  | 'directory'
  | 'env_var'
  | 'process'
  | 'mcp_tool'
  | 'mcp_resource'
  | 'generated'
  | 'logic';

export type MarkerStatus =
  | 'present'
  | 'missing'
  | 'partially_present'
  | 'broken'
  | 'mismatched';

export type Confidence = 'certain' | 'high' | 'medium' | 'low' | 'guessed';

export type OperationKind =
  | 'create_file'
  | 'modify_file'
  | 'create_directory'
  | 'run_command'
  | 'preserve'
  | 'skip';

export type OperationRisk = 'low' | 'medium' | 'high';

export interface DetectedMarker {
  id: string;
  kind: MarkerKind;
  path?: string;
  sourceSystem: SourceSystem;
  confidence: Confidence;
  status: MarkerStatus;
}

export interface CapabilityScanResult {
  id: string;
  kind: CapabilityKind;
  sourceSystem: SourceSystem;
  installed: boolean;
  initialized: boolean;
  enabled: boolean;
  mode: CapabilityMode;
  health: HealthStatus;
  version?: string;
  markerIds: string[];
}

export interface ScanWarning {
  id: string;
  severity: 'info' | 'warning';
  title: string;
  detail: string;
  markerIds: string[];
  capabilityIds: string[];
}

export interface ScanBlocker {
  id: string;
  title: string;
  detail: string;
  markerIds: string[];
  recommendedAction: string;
}

export interface UpgradeProposalInput {
  canProposeMinimal: boolean;
  canProposeStandard: boolean;
  canProposeFull: boolean;
  recommendedPreset: string;
  createCandidates: string[];
  modifyCandidates: string[];
  preserveCandidates: string[];
  migrationSources: SourceSystem[];
  rollbackNotes: string[];
}

export interface ProjectCapabilityScan {
  rootPath: string;
  scannedAt: string;
  initializationState: string;
  markers: DetectedMarker[];
  capabilities: CapabilityScanResult[];
  warnings: ScanWarning[];
  blockers: ScanBlocker[];
  upgradeInputs: UpgradeProposalInput;
  totalFileCount: number;
  scanDurationMs: number;
  projectHealthScore: number;
}

export interface ProposalOperation {
  id: string;
  kind: OperationKind;
  path?: string;
  command?: string;
  sourceSystem: SourceSystem;
  reason: string;
  preview?: string;
  risk: OperationRisk;
  requiresApproval: boolean;
}

export interface InitializationProposal {
  id: string;
  rootPath: string;
  createdAt: string;
  preset: string;
  summary: string;
  operations: ProposalOperation[];
  warnings: ScanWarning[];
  blockers: ScanBlocker[];
}

export interface ProposalProgress {
  proposalId: string;
  totalOperations: number;
  completedOperations: number;
  currentOperationId: string;
  currentOperationName: string;
  status: 'running' | 'completed' | 'failed';
  message: string;
  error?: string;
}

export interface ProjectIntelligence {
  git?: {
    branch: string;
    isDirty: boolean;
    uncommittedCount: number;
    recentCommits: Array<{
      hash: string;
      message: string;
      author: string;
      date: string;
    }>;
    remote?: string;
    ahead: number;
    behind: number;
  };
  stacks: Array<{
    name: string;
    icon: string;
    version?: string;
    configFile: string;
  }>;
  health: {
    score: number;
    hasGit: boolean;
    hasReadme: boolean;
    hasCi: boolean;
    hasTests: boolean;
    hasLinter: boolean;
    hasLockfile: boolean;
  };
  gitnexus?: {
    symbols: number;
    relationships: number;
    processes: number;
    stale: boolean;
  };
}

// ============================================================================
// Phase 47: Synaptic & Architect Types
// ============================================================================

export interface SynapticMetrics {
  feedbackLoops: number;
  activeOptimizations: number;
  cognitiveLoad: number;
  swarmCohesion: number;
}

export interface ArchitectFinding {
  id: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  findingType: 'COMPLEXITY' | 'CYCLE' | 'FAN_IN';
  title: string;
  description: string;
  filePath: string;
  symbolName: string;
}

export interface ArchitectAuditReport {
  structuralDrift: number;
  graphStability: number;
  findings: ArchitectFinding[];
  timestamp: number;
}

export interface PolicyProposal {
  id: string;
  title: string;
  description: string;
  currentValue: string;
  proposedValue: string;
  rationale: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface PersonaEvolutionProposal {
  id: string;
  personaId: string;
  title: string;
  description: string;
  mutationType: 'ADD_TOOL' | 'ADD_EXPERTISE';
  mutationValue: string;
  performanceGain: number;
  rationale: string;
  status: 'PENDING' | 'APPLIED' | 'REJECTED';
}

export interface CognitiveNode {
  id: string;
  name: string;
  nodeType: 'agent' | 'memory' | 'task' | 'cluster';
  val: number;
  color: string;
  children?: CognitiveNode[];
  metadata?: Record<string, any>;
}

export interface CognitiveLink {
  source: string;
  target: string;
  linkType: string;
}

export interface CognitiveTopology {
  nodes: CognitiveNode[];
  links: CognitiveLink[];
}

export interface AgentVote {
  agentId: string;
  agentName: string;
  proposalId: string;
  score: number;
  rationale: string;
}

export interface ConsensusProposal {
  id: string;
  title: string;
  description: string;
}

export interface ConsensusRound {
  id: string;
  issueDescription: string;
  competingProposals: ConsensusProposal[];
  votes: AgentVote[];
  status: 'ACTIVE' | 'RESOLVED';
  winnerId?: string;
}

export interface ThoughtStep {
  id: string;
  parentId?: string;
  timestamp: number;
  role: 'hypothesis' | 'evidence' | 'evaluation' | 'decision';
  content: string;
  evaluationScore?: number;
  status: 'active' | 'completed' | 'discarded';
}

export interface ThoughtChain {
  agentId: string;
  taskId: string;
  steps: ThoughtStep[];
}
