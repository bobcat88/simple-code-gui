import { AgentAction, AgentStatus } from '../../api/types'

export type { AgentAction, AgentStatus }

export interface OrchestrationState {
  agents: AgentStatus[]
  recentActions: AgentAction[]
  pendingApprovals: AgentAction[]
}
