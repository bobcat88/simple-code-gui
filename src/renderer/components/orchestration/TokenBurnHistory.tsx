import React, { useEffect, useMemo, useState } from 'react'
import { BarChart3, Coins, Cpu, Database, Filter } from 'lucide-react'
import type { Api, BackendId, TokenHistoryFilters, TokenHistoryResponse } from '../../api/types.js'
import { cn } from '../../lib/utils'

const BACKENDS: Array<{ id: BackendId; label: string }> = [
  { id: 'claude', label: 'Claude' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'codex', label: 'Codex' },
  { id: 'opencode', label: 'OpenCode' },
  { id: 'aider', label: 'Aider' },
]

interface TokenBurnHistoryProps {
  api: Api
}

function formatCompact(value: number): string {
  return Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function shortProjectName(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).pop() || path
}

function toDayBoundary(date: string, endOfDay = false): string | undefined {
  if (!date) return undefined
  return `${date} ${endOfDay ? '23:59:59' : '00:00:00'}`
}

export function TokenBurnHistory({ api }: TokenBurnHistoryProps): React.ReactElement {
  const [history, setHistory] = useState<TokenHistoryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [projectPath, setProjectPath] = useState('')
  const [backend, setBackend] = useState<'' | BackendId>('')

  const filters = useMemo<TokenHistoryFilters>(() => ({
    startDate: toDayBoundary(startDate),
    endDate: toDayBoundary(endDate, true),
    projectPath: projectPath || undefined,
    backend: backend || undefined,
  }), [backend, endDate, projectPath, startDate])

  useEffect(() => {
    let cancelled = false

    async function fetchHistory() {
      if (!api.getTokenHistory) return

      setLoading(true)
      setError(null)
      try {
        const nextHistory = await api.getTokenHistory(filters)
        if (!cancelled) {
          setHistory(nextHistory)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchHistory()
    const interval = setInterval(fetchHistory, 15000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [api, filters])

  const totalTokens = (history?.totals.inputTokens || 0) + (history?.totals.outputTokens || 0)
  const maxDailyTokens = Math.max(
    1,
    ...(history?.daily.map(point => point.inputTokens + point.outputTokens) || [1])
  )
  const projects = history?.projectBreakdown.map(item => item.key) || []

  if (!api.getTokenHistory) {
    return (
      <div className="rounded-xl border border-white/5 bg-black/10 p-3 text-xs text-muted-foreground">
        Token history is unavailable for this backend.
      </div>
    )
  }

  return (
    // AC: @01KPNWTT ac-4
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/5 bg-black/10 p-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Cpu size={11} />
            Tokens
          </div>
          <div className="mt-1 text-lg font-semibold text-white/90">{formatCompact(totalTokens)}</div>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/10 p-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Coins size={11} />
            Cost
          </div>
          <div className="mt-1 text-lg font-semibold text-white/90">${(history?.totals.costEstimate || 0).toFixed(3)}</div>
        </div>
        <div className="rounded-xl border border-white/5 bg-black/10 p-3">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Database size={11} />
            Rows
          </div>
          <div className="mt-1 text-lg font-semibold text-white/90">{history?.totals.transactionCount || 0}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          From
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs normal-case tracking-normal text-white/80"
          />
        </label>
        <label className="space-y-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          To
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs normal-case tracking-normal text-white/80"
          />
        </label>
        <label className="space-y-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          Project
          <select
            value={projectPath}
            onChange={(event) => setProjectPath(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs normal-case tracking-normal text-white/80"
          >
            <option value="">All projects</option>
            {projects.map(project => (
              <option key={project} value={project}>{shortProjectName(project)}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          Backend
          <select
            value={backend}
            onChange={(event) => setBackend(event.target.value as '' | BackendId)}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs normal-case tracking-normal text-white/80"
          >
            <option value="">All backends</option>
            {BACKENDS.map(item => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-white/5 bg-black/10 p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
            <BarChart3 size={14} />
            Daily burn
          </div>
          {loading && <span className="text-[10px] text-muted-foreground">Refreshing</span>}
        </div>
        <div className="flex h-24 items-end gap-1">
          {(history?.daily.length ? history.daily : [{ date: 'No data', inputTokens: 0, outputTokens: 0, costEstimate: 0 }]).map(point => {
            const total = point.inputTokens + point.outputTokens
            return (
              <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div className="flex h-20 w-full items-end rounded bg-white/5">
                  <div
                    className={cn("w-full rounded bg-primary/70", total === 0 && "bg-white/10")}
                    style={{ height: `${Math.max(4, (total / maxDailyTokens) * 100)}%` }}
                    title={`${point.date}: ${total.toLocaleString()} tokens`}
                  />
                </div>
                <span className="max-w-full truncate text-[9px] text-muted-foreground">{point.date.slice(5)}</span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <BreakdownList title="Projects" items={history?.projectBreakdown || []} />
        <BreakdownList title="Backends" items={history?.backendBreakdown || []} />
      </div>

      <div className="rounded-xl border border-white/5 bg-black/10">
        <div className="flex items-center gap-1.5 border-b border-white/5 px-3 py-2 text-xs font-semibold text-white/80">
          <Filter size={13} />
          Sessions
        </div>
        <div className="max-h-48 overflow-y-auto">
          {error ? (
            <div className="p-3 text-xs text-red-300">{error}</div>
          ) : history?.sessions.length ? (
            history.sessions.map(session => (
              <div key={`${session.sessionId}-${session.projectPath}-${session.backend}`} className="border-b border-white/5 px-3 py-2 last:border-0">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-white/80">{shortProjectName(session.projectPath)}</span>
                  <span className="text-muted-foreground">{formatCompact(session.inputTokens + session.outputTokens)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                  <span>{session.backend} · {session.transactionCount} rows</span>
                  <span>{session.lastTimestamp.slice(0, 10)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-3 text-xs text-muted-foreground">No token transactions found.</div>
          )}
        </div>
      </div>
    </div>
  )
}

function BreakdownList({
  title,
  items,
}: {
  title: string
  items: TokenHistoryResponse['projectBreakdown']
}) {
  const maxTokens = Math.max(1, ...items.map(item => item.inputTokens + item.outputTokens))

  return (
    <div className="rounded-xl border border-white/5 bg-black/10 p-3">
      <div className="mb-2 text-xs font-semibold text-white/80">{title}</div>
      <div className="space-y-2">
        {(items.length ? items : [{ key: 'No data', inputTokens: 0, outputTokens: 0, costEstimate: 0 }]).slice(0, 5).map(item => {
          const total = item.inputTokens + item.outputTokens
          return (
            <div key={item.key} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="truncate text-muted-foreground">{title === 'Projects' ? shortProjectName(item.key) : item.key}</span>
                <span className="text-white/70">{formatCompact(total)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${(total / maxTokens) * 100}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
