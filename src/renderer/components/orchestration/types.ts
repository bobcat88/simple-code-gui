import { AgentAction, AgentStatus } from '../../api/types'

export type { AgentAction, AgentStatus }

export interface SystemTelemetry {
  cpu: number
  memory: number
  activeJobs: number
  uptime: number
  health: 'healthy' | 'degraded' | 'critical'
}

export interface OrchestrationState {
  agents: AgentStatus[]
  recentActions: AgentAction[]
  pendingApprovals: AgentAction[]
  telemetry?: SystemTelemetry
}
