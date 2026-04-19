import React from 'react'
import { ProjectIntelligence } from '../../api/types.js'

interface IntelligencePanelProps {
  intelligence: ProjectIntelligence | null
  loading: boolean
  error: string | null
  projectName: string | null
}

export function IntelligencePanel({ intelligence, loading, error, projectName }: IntelligencePanelProps) {
  if (!projectName) return null

  return (
    <div className="intelligence-panel">
      <div className="panel-header">
        <span className="panel-title">Project Intelligence</span>
        <span className="project-tag">{projectName}</span>
      </div>
      
      {loading ? (
        <div className="panel-loading">Analyzing project...</div>
      ) : error ? (
        <div className="panel-error">Failed to analyze project: {error}</div>
      ) : intelligence ? (
        <div className="panel-content">
          <div className="health-section">
            <div className="health-label">
              <span>Repo Health</span>
              <span className="health-value">{intelligence.repoHealth}%</span>
            </div>
            <div className="health-bar-container">
              <div 
                className={`health-bar ${intelligence.repoHealth < 50 ? 'bad' : intelligence.repoHealth < 80 ? 'warning' : 'good'}`}
                style={{ width: `${intelligence.repoHealth}%` }}
              />
            </div>
          </div>

          <div className="stack-section">
            <div className="section-label">Tech Stack</div>
            <div className="stack-tags">
              {intelligence.stacks.map(stack => (
                <span key={stack} className="stack-tag">{stack}</span>
              ))}
              {intelligence.stacks.length === 0 && <span className="empty-msg">No stack detected</span>}
            </div>
          </div>

          {intelligence.gitNexusContext && (
            <div className="context-section">
              <div className="section-label">GitNexus</div>
              <div className="context-msg">{intelligence.gitNexusContext}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="panel-empty">Select a project to see intelligence</div>
      )}
    </div>
  )
}
