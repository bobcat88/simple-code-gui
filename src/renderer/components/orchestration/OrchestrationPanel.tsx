import React, { useState, useEffect, useRef } from 'react'
import { AgentAction, AgentStatus, OrchestrationState } from './types'
import './OrchestrationPanel.css'

declare global {
  interface Window {
    api: any
  }
}

export function OrchestrationPanel() {
  const [state, setState] = useState<OrchestrationState>({
    agents: [],
    recentActions: [],
    pendingApprovals: []
  })
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll activity feed
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [state.recentActions])

  // Real-time API Integration
  useEffect(() => {
    if (!window.api) return

    const unsubAction = window.api.onAgentAction((action: AgentAction) => {
      setState(prev => {
        const newState = { ...prev }
        
        // Add to recent actions (limit to 50)
        newState.recentActions = [...prev.recentActions, action].slice(-50)
        
        // Handle approvals
        if (action.type === 'approval_request') {
          newState.pendingApprovals = [...prev.pendingApprovals, action]
        } else if (action.type === 'success' || action.type === 'error') {
          // If this was a response to an approval, remove it
          newState.pendingApprovals = prev.pendingApprovals.filter(a => a.id !== action.id)
        }
        
        return newState
      })
    })

    const unsubStatus = window.api.onAgentStatus((status: AgentStatus) => {
      setState(prev => {
        const existingIndex = prev.agents.findIndex(a => a.id === status.id)
        let newAgents = [...prev.agents]
        
        if (existingIndex >= 0) {
          newAgents[existingIndex] = { ...newAgents[existingIndex], ...status }
        } else {
          newAgents.push(status)
        }
        
        return { ...prev, agents: newAgents }
      })
    })

    return () => {
      unsubAction()
      unsubStatus()
    }
  }, [])

  const handleApprove = async (id: string) => {
    try {
      await window.api.approveAction(id)
      setState(prev => ({
        ...prev,
        pendingApprovals: prev.pendingApprovals.filter(a => a.id !== id)
      }))
    } catch (err) {
      console.error('Failed to approve action:', err)
    }
  }

  const handleReject = async (id: string) => {
    try {
      await window.api.rejectAction(id)
      setState(prev => ({
        ...prev,
        pendingApprovals: prev.pendingApprovals.filter(a => a.id !== id)
      }))
    } catch (err) {
      console.error('Failed to reject action:', err)
    }
  }

  return (
    <div className="orchestration-panel">
      <div className="orchestration-header">
        <h2>Orchestration Hub</h2>
        <div className="status-summary">
          <span className="dot busy"></span> {state.agents.filter(a => a.status === 'busy').length} Active
          <span className="dot blocked"></span> {state.agents.filter(a => a.status === 'blocked').length} Blocked
        </div>
      </div>

      <div className="agents-grid">
        {state.agents.length === 0 && (
          <div className="no-agents">No active agents</div>
        )}
        {state.agents.map(agent => (
          <div key={agent.id} className={`agent-card ${agent.status}`}>
            <div className="agent-info">
              <span className="agent-name">{agent.name}</span>
              <span className={`status-tag ${agent.status}`}>{agent.status}</span>
            </div>
            {agent.currentTask && (
              <div className="agent-task">
                <span className="task-label">Working on:</span>
                <span className="task-name">{agent.currentTask}</span>
              </div>
            )}
            {agent.progress !== undefined && (
              <div className="agent-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${agent.progress}%` }}></div>
                </div>
                <span className="progress-text">{agent.progress}%</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="activity-feed">
        <h3>Live Activity</h3>
        <div className="actions-list" ref={scrollRef}>
          {state.recentActions.length === 0 && (
            <div className="no-activity">Waiting for agent activity...</div>
          )}
          {state.recentActions.map(action => (
            <div key={action.id} className={`action-item ${action.type}`}>
              <span className="action-timestamp">{new Date(action.timestamp).toLocaleTimeString()}</span>
              <span className="action-agent">[{action.agentName}]</span>
              <span className="action-message">{action.message}</span>
            </div>
          ))}
        </div>
      </div>

      {state.pendingApprovals.length > 0 && (
        <div className="approvals-section">
          <h3>Pending Approvals</h3>
          {state.pendingApprovals.map(approval => (
            <div key={approval.id} className="approval-card">
              <div className="approval-info">
                <span className="approval-agent">{approval.agentName}</span>
                <p>{approval.message}</p>
              </div>
              <div className="approval-actions">
                <button 
                  className="btn-approve"
                  onClick={() => handleApprove(approval.id)}
                >
                  Approve
                </button>
                <button 
                  className="btn-reject"
                  onClick={() => handleReject(approval.id)}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
