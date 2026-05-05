import { AgentAction, AgentStatus, SystemTelemetry } from '../../api/types'

export type { AgentAction, AgentStatus, SystemTelemetry }

export interface OrchestrationState {
  agents: AgentStatus[]
  recentActions: AgentAction[]
  pendingApprovals: AgentAction[]
  telemetry: SystemTelemetry
}

export interface ApprovalRequest extends AgentAction {
  type: 'approval_request'
  metadata: {
    type: 'file_change' | 'command' | 'config_change'
    diff?: string
    command?: string
    risk?: 'low' | 'medium' | 'high'
    riskReason?: string
    impact?: string[]
  }
}
