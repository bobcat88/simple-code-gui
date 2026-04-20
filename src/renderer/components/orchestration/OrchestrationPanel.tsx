import React, { useState, useEffect, useRef } from 'react'
import { 
  Activity, 
  Terminal, 
  Lightbulb, 
  AlertCircle, 
  CheckCircle2, 
  UserCheck, 
  ShieldAlert,
  Cpu,
  Clock,
  ExternalLink,
  Brain,
  Hammer,
  Eye,
  Zap,
  Database,
  Timer
} from 'lucide-react'
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
    pendingApprovals: [],
    telemetry: {
      cpu: 0,
      memory: 0,
      activeJobs: 0,
      uptime: 0,
      health: 'healthy'
    }
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

    const unsubTelemetry = window.api.onTelemetry((telemetry: any) => {
      setState(prev => ({ ...prev, telemetry }))
    })

    return () => {
      unsubAction()
      unsubStatus()
      unsubTelemetry()
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
        <div className="header-title-container">
          <h2>Orchestration Hub</h2>
          <div className="system-health">
            <div className={`health-dot ${state.telemetry?.health || 'healthy'}`}></div>
            <span>System {state.telemetry?.health || 'Healthy'}</span>
          </div>
        </div>
        
        <div className="system-telemetry">
          <div className="telemetry-item" title="CPU Usage">
            <Zap size={14} />
            <span>{state.telemetry?.cpu || 0}%</span>
          </div>
          <div className="telemetry-item" title="Memory Usage">
            <Database size={14} />
            <span>{state.telemetry?.memory || 0}MB</span>
          </div>
          <div className="telemetry-item" title="Active Jobs">
            <Activity size={14} />
            <span>{state.telemetry?.activeJobs || 0}</span>
          </div>
          <div className="telemetry-item" title="System Uptime">
            <Clock size={14} />
            <span>{Math.floor((state.telemetry?.uptime || 0) / 3600)}h {Math.floor(((state.telemetry?.uptime || 0) % 3600) / 60)}m</span>
          </div>
        </div>
      </div>

      <div className="agents-grid">
        {state.agents.length === 0 && (
          <div className="no-agents">No active agents</div>
        )}
        {state.agents.map(agent => (
          <div key={agent.id} className={`agent-card ${agent.status}`}>
            <div className="agent-header">
              <div className="agent-role-icon">
                {agent.role === 'Planner' && <Brain size={18} />}
                {agent.role === 'Builder' && <Hammer size={18} />}
                {agent.role === 'Reviewer' && <Eye size={18} />}
                {!agent.role && <Cpu size={18} />}
              </div>
              <div className="agent-title">
                <span className="agent-name">{agent.name}</span>
                <span className="agent-role-label">{agent.role || 'Agent'}</span>
              </div>
              <div className={`status-dot ${agent.status}`}></div>
            </div>

            <div className="agent-body">
              {agent.currentTask ? (
                <div className="agent-task">
                  <span className="task-label">Active Task</span>
                  <span className="task-name">{agent.currentTask}</span>
                </div>
              ) : (
                <div className="agent-idle">
                  <span>Standing by for instructions</span>
                </div>
              )}

              {agent.progress !== undefined && agent.status === 'busy' && (
                <div className="agent-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${agent.progress}%` }}></div>
                  </div>
                  <span className="progress-text">{agent.progress}%</span>
                </div>
              )}
            </div>

            {agent.metrics && (
              <div className="agent-metrics">
                <div className="metric-item" title="Tasks Completed">
                  <Zap size={12} />
                  <span>{agent.metrics.tasksCompleted}</span>
                </div>
                <div className="metric-item" title="Uptime">
                  <Timer size={12} />
                  <span>{Math.floor(agent.metrics.uptime / 60)}m</span>
                </div>
                {agent.metrics.memoryUsage && (
                  <div className="metric-item" title="Memory Usage">
                    <Database size={12} />
                    <span>{agent.metrics.memoryUsage}MB</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="activity-feed">
        <div className="feed-header">
          <Activity size={16} className="header-icon" />
          <h3>Live Activity Feed</h3>
        </div>
        <div className="actions-list" ref={scrollRef}>
          {state.recentActions.length === 0 && (
            <div className="no-activity">
              <Cpu size={32} className="empty-icon" />
              <p>Waiting for agent activity...</p>
            </div>
          )}
          {state.recentActions.map(action => (
            <div key={action.id} className={`action-item ${action.type}`}>
              <div className="action-icon">
                {action.type === 'thought' && <Lightbulb size={14} />}
                {action.type === 'command' && <Terminal size={14} />}
                {action.type === 'error' && <AlertCircle size={14} />}
                {action.type === 'success' && <CheckCircle2 size={14} />}
                {action.type === 'approval_request' && <ShieldAlert size={14} />}
              </div>
              <div className="action-content">
                <div className="action-meta">
                  <span className="action-agent">{action.agentName}</span>
                  <div className="action-time">
                    <Clock size={10} />
                    <span className="action-timestamp">{new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                </div>
                <div className="action-message-container">
                  <span className="action-message">{action.message}</span>
                  {action.metadata?.file && (
                    <div className="action-file">
                      <ExternalLink size={10} />
                      <span>{action.metadata.file}</span>
                    </div>
                  )}
                </div>
              </div>
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
