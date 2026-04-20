import React, { useEffect, useMemo } from 'react'
import { useTelemetryStore, TelemetryData } from '../stores/telemetry'
import { useWorkspaceStore, Project } from '../stores/workspace'
import { useModals } from '../contexts/ModalContext'

interface HomeDashboardProps {
  onOpenSession: (projectPath: string, sessionId?: string, slug?: string, initialPrompt?: string, forceNewSession?: boolean) => void
}

export function HomeDashboard({ onOpenSession }: HomeDashboardProps): React.ReactElement {
  const globalStats = useTelemetryStore(state => state.global)
  const projectStats = useTelemetryStore(state => state.projectStats)
  const budgetStatus = useTelemetryStore(state => state.budgetStatus)
  const fetchProjectStats = useTelemetryStore(state => state.fetchProjectStats)
  const checkBudget = useTelemetryStore(state => state.checkBudget)
  const projects = useWorkspaceStore(state => state.projects)
  const { openMakeProject, openSettings } = useModals()

  useEffect(() => {
    projects.forEach(p => {
      fetchProjectStats(p.path)
      checkBudget(p.path)
    })
    checkBudget() // Global budget
  }, [projects, fetchProjectStats, checkBudget])

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return num.toString()
  }

  const sortedProjects = useMemo(() => {
    return [...projects].sort((a, b) => {
      const statsA = projectStats[a.path]?.tokens.total || 0
      const statsB = projectStats[b.path]?.tokens.total || 0
      return statsB - statsA // Most active first
    })
  }, [projects, projectStats])

  return (
    <div className="home-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Workspace Overview</h1>
          <p className="subtitle">AI Token Economics & Activity</p>
        </div>
        <div className="header-actions">
          <button className="dashboard-btn" onClick={openSettings}>Settings</button>
          <button className="dashboard-btn primary" onClick={openMakeProject}>+ New Project</button>
        </div>
      </header>

      <section className="stats-grid">
        <div className="stats-card global">
          <div className="card-label">Total Consumption</div>
          <div className="card-value">{formatNumber(globalStats.tokens.total)} <small>tokens</small></div>
          <div className="card-sub-value">Prompt: {formatNumber(globalStats.tokens.prompt)} | Comp: {formatNumber(globalStats.tokens.completion)}</div>
        </div>
        <div className="stats-card cost">
          <div className="card-label">Total Investment</div>
          <div className="card-value">${globalStats.cost.toFixed(2)}</div>
          <div className="card-sub-value">Est. Market Value</div>
        </div>
        <div className="stats-card savings">
          <div className="card-label">Efficiency Gains</div>
          <div className="card-value">${globalStats.savings.toFixed(2)}</div>
          <div className="card-sub-value">Saved via Cache & MCP</div>
        </div>
        <div className="stats-card alert">
          <div className="card-label">Budget Health</div>
          <div className={`card-value ${budgetStatus['global']?.exceeded ? 'exceeded' : 'healthy'}`}>
            {budgetStatus['global']?.exceeded ? 'EXCEEDED' : 'HEALTHY'}
          </div>
          <div className="card-sub-value">{budgetStatus['global']?.reason || 'Within global limits'}</div>
        </div>
      </section>

      <section className="projects-section">
        <h3>Project Activity</h3>
        <div className="project-grid">
          {sortedProjects.map(project => {
            const stats = projectStats[project.path] || { tokens: { total: 0 }, cost: 0 }
            const status = budgetStatus[project.path]
            
            return (
              <div 
                key={project.path} 
                className={`project-card ${status?.exceeded ? 'alert' : ''}`}
                onClick={() => onOpenSession(project.path)}
                style={{ cursor: 'pointer' }}
              >
                <div className="project-card-header">
                  <div className="project-icon">📂</div>
                  <div className="project-info">
                    <div className="project-name">{project.name}</div>
                    <div className="project-path">{project.path}</div>
                  </div>
                </div>
                <div className="project-card-body">
                  <div className="project-stat">
                    <span>Tokens</span>
                    <span>{formatNumber(stats.tokens.total)}</span>
                  </div>
                  <div className="project-stat">
                    <span>Cost</span>
                    <span>${stats.cost.toFixed(3)}</span>
                  </div>
                  {status?.exceeded && (
                    <div className="project-budget-alert">
                      ⚠️ {status.reason}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          {projects.length === 0 && (
            <div className="empty-projects" onClick={openMakeProject}>
              <div className="empty-icon">+</div>
              <p>Add your first project to see activity</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
