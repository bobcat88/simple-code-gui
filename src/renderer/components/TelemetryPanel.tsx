/**
 * TelemetryPanel — displays token usage, estimated cost, and RTK savings.
 * Renders in the sidebar area or as a collapsible overlay.
 */

import React, { useState, useEffect, useCallback } from 'react'

interface SessionTelemetry {
  sessionId: string
  ptyId: string
  projectPath: string
  backend: string
  startedAt: number
  lastUpdatedAt: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCacheReadTokens: number
  totalCacheWriteTokens: number
  estimatedCost: number
  eventCount: number
}

interface RtkSavings {
  totalSaved: number
  percentSaved: number
  commandCount: number
  lastUpdated: number
}

interface TelemetrySummary {
  sessions: SessionTelemetry[]
  aggregate: {
    totalTokens: number
    totalInputTokens: number
    totalOutputTokens: number
    totalCacheReadTokens: number
    totalCacheWriteTokens: number
    estimatedCost: number
    sessionCount: number
  }
  rtkSavings: RtkSavings | null
}

function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return String(count)
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  if (cost < 1) return `$${cost.toFixed(3)}`
  return `$${cost.toFixed(2)}`
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function projectName(path: string): string {
  return path.split('/').pop() || path
}

interface TelemetryPanelProps {
  activeTabPtyId?: string | null
}

export function TelemetryPanel({ activeTabPtyId }: TelemetryPanelProps): React.ReactElement {
  const [summary, setSummary] = useState<TelemetrySummary | null>(null)
  const [rtkAvailable, setRtkAvailable] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showSessions, setShowSessions] = useState(false)

  // Initial load
  useEffect(() => {
    window.electronAPI?.telemetryGetSummary?.().then(setSummary)
    window.electronAPI?.telemetryRtkAvailable?.().then(setRtkAvailable)
  }, [])

  // Listen for real-time updates
  useEffect(() => {
    const unsub = window.electronAPI?.onTelemetryUpdated?.((data: TelemetrySummary) => {
      setSummary(data)
    })
    return () => { unsub?.() }
  }, [])

  const refreshRtk = useCallback(() => {
    window.electronAPI?.telemetryRtkRefresh?.().then(() => {
      window.electronAPI?.telemetryGetSummary?.().then(setSummary)
    })
  }, [])

  if (!summary || (summary.aggregate.totalTokens === 0 && !summary.rtkSavings)) {
    return <></>
  }

  const { aggregate, sessions, rtkSavings } = summary
  const activeSession = activeTabPtyId
    ? sessions.find(s => s.ptyId === activeTabPtyId)
    : null

  return (
    <div className="telemetry-panel">
      <button
        className="telemetry-panel-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="telemetry-panel-title">Token Usage</span>
        <span className="telemetry-panel-summary">
          {formatTokenCount(aggregate.totalTokens)} tokens &middot; {formatCost(aggregate.estimatedCost)}
        </span>
        <span className="telemetry-panel-caret">{expanded ? '\u25BC' : '\u25B6'}</span>
      </button>

      {expanded && (
        <div className="telemetry-panel-body">
          {/* Active session */}
          {activeSession && (
            <div className="telemetry-section">
              <div className="telemetry-section-title">Active Session</div>
              <div className="telemetry-row">
                <span>Input</span>
                <span>{formatTokenCount(activeSession.totalInputTokens)}</span>
              </div>
              <div className="telemetry-row">
                <span>Output</span>
                <span>{formatTokenCount(activeSession.totalOutputTokens)}</span>
              </div>
              {activeSession.totalCacheReadTokens > 0 && (
                <div className="telemetry-row telemetry-row--dim">
                  <span>Cache Read</span>
                  <span>{formatTokenCount(activeSession.totalCacheReadTokens)}</span>
                </div>
              )}
              <div className="telemetry-row telemetry-row--highlight">
                <span>Cost</span>
                <span>{formatCost(activeSession.estimatedCost)}</span>
              </div>
              <div className="telemetry-row telemetry-row--dim">
                <span>Duration</span>
                <span>{formatDuration(Date.now() - activeSession.startedAt)}</span>
              </div>
            </div>
          )}

          {/* Aggregate totals */}
          <div className="telemetry-section">
            <div className="telemetry-section-title">
              All Sessions ({aggregate.sessionCount})
            </div>
            <div className="telemetry-row">
              <span>Total Tokens</span>
              <span>{formatTokenCount(aggregate.totalTokens)}</span>
            </div>
            <div className="telemetry-row">
              <span>Input / Output</span>
              <span>{formatTokenCount(aggregate.totalInputTokens)} / {formatTokenCount(aggregate.totalOutputTokens)}</span>
            </div>
            <div className="telemetry-row telemetry-row--highlight">
              <span>Total Cost</span>
              <span>{formatCost(aggregate.estimatedCost)}</span>
            </div>
          </div>

          {/* RTK Savings */}
          {rtkAvailable && (
            <div className="telemetry-section">
              <div className="telemetry-section-title">
                RTK Savings
                <button className="telemetry-refresh-btn" onClick={refreshRtk} title="Refresh RTK data">
                  &#x21BB;
                </button>
              </div>
              {rtkSavings ? (
                <>
                  <div className="telemetry-row telemetry-row--highlight">
                    <span>Tokens Saved</span>
                    <span>{formatTokenCount(rtkSavings.totalSaved)}</span>
                  </div>
                  <div className="telemetry-row">
                    <span>Savings Rate</span>
                    <span>{rtkSavings.percentSaved.toFixed(1)}%</span>
                  </div>
                  <div className="telemetry-row telemetry-row--dim">
                    <span>Commands</span>
                    <span>{rtkSavings.commandCount}</span>
                  </div>
                </>
              ) : (
                <div className="telemetry-row telemetry-row--dim">
                  <span>No data yet</span>
                </div>
              )}
            </div>
          )}

          {/* Per-session breakdown */}
          {sessions.length > 1 && (
            <div className="telemetry-section">
              <button
                className="telemetry-sessions-toggle"
                onClick={() => setShowSessions(!showSessions)}
              >
                {showSessions ? '\u25BC' : '\u25B6'} Per-Session Breakdown
              </button>
              {showSessions && (
                <div className="telemetry-sessions-list">
                  {sessions
                    .sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt)
                    .map(s => (
                      <div
                        key={s.ptyId}
                        className={`telemetry-session-item ${s.ptyId === activeTabPtyId ? 'active' : ''}`}
                      >
                        <div className="telemetry-session-name">
                          {projectName(s.projectPath)} ({s.backend})
                        </div>
                        <div className="telemetry-session-stats">
                          {formatTokenCount(s.totalTokens)} tokens &middot; {formatCost(s.estimatedCost)}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
