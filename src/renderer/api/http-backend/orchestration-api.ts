import { AgentAction, AgentStatus, Unsubscribe } from '../types'
import { ConnectionManager } from './connection'
import { PtyWebSocketManager } from './pty-websocket'

export class OrchestrationApi {
  private connection: ConnectionManager
  private wsManager: PtyWebSocketManager

  constructor(connection: ConnectionManager, wsManager: PtyWebSocketManager) {
    this.connection = connection
    this.wsManager = wsManager
  }

  /**
   * Subscribe to agent actions
   */
  onAgentAction(callback: (action: AgentAction) => void): Unsubscribe {
    // In a real implementation, we would use a specialized WebSocket channel
    // For now, we'll return a stub
    console.log('[OrchestrationApi] onAgentAction subscribed (stub)')
    return () => {}
  }

  /**
   * Subscribe to agent status updates
   */
  onAgentStatus(callback: (status: AgentStatus) => void): Unsubscribe {
    // Stub
    console.log('[OrchestrationApi] onAgentStatus subscribed (stub)')
    return () => {}
  }

  /**
   * Approve a pending action
   */
  async approveAction(actionId: string): Promise<{ success: boolean }> {
    return this.connection.fetchJson<{ success: boolean }>(`/api/orchestration/approve/${actionId}`, {
      method: 'POST'
    })
  }

  /**
   * Reject a pending action
   */
  async rejectAction(actionId: string): Promise<{ success: boolean }> {
    return this.connection.fetchJson<{ success: boolean }>(`/api/orchestration/reject/${actionId}`, {
      method: 'POST'
    })
  }
}
