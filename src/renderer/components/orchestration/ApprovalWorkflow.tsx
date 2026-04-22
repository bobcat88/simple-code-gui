import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  FileText,
  GitBranch,
  MessageSquareMore,
  ShieldAlert,
  XCircle,
} from 'lucide-react'
import { cn } from '../../lib/utils.js'
import type { ApprovalRequest } from '../../api/types.js'

type ReviewDecision = 'pending' | 'approved' | 'rejected' | 'modified'
type FileDiff = NonNullable<ApprovalRequest['fileDiffs']>[number]
type DiffHunk = FileDiff['hunks'][number]

export interface ApprovalWorkflowProps {
  requests: ApprovalRequest[]
  onApprove?: (request: ApprovalRequest, note: string) => void | Promise<void>
  onReject?: (request: ApprovalRequest, note: string) => void | Promise<void>
  onRequestChanges?: (request: ApprovalRequest, note: string, conditions: string[]) => void | Promise<void>
  emptyTitle?: string
  emptyDescription?: string
}

const RISK_STYLES: Record<ApprovalRequest['risk'], string> = {
  low: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  medium: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  high: 'border-orange-500/20 bg-orange-500/10 text-orange-300',
  critical: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
}

const DECISION_STYLES: Record<ReviewDecision, string> = {
  pending: 'border-white/10 bg-white/5 text-zinc-300',
  approved: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  rejected: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
  modified: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
}

const DECISION_LABELS: Record<ReviewDecision, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  modified: 'Needs changes',
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

function shortPath(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).pop() || path
}

function parseConditions(value: string): string[] {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function formatCategory(category: ApprovalRequest['category']): string {
  switch (category) {
    case 'file_change':
      return 'File change'
    case 'command':
      return 'Command'
    case 'config_change':
      return 'Config change'
    case 'destructive':
      return 'Destructive'
    case 'external':
      return 'External'
    default:
      return category
  }
}

function DiffHunkBlock({
  oldStart,
  newStart,
  lines,
}: DiffHunk) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/5 bg-black/30">
      <div className="border-b border-white/5 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        @@ -{oldStart} +{newStart} @@
      </div>
      <div className="space-y-0.5 px-2 py-2 font-mono text-[11px] leading-5">
        {lines.map((line, index) => (
          <div
            key={`${line}-${index}`}
            className={cn(
              'whitespace-pre-wrap break-words',
              line.startsWith('+') && 'text-emerald-300',
              line.startsWith('-') && 'text-rose-300',
              !line.startsWith('+') && !line.startsWith('-') && 'text-zinc-300'
            )}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  )
}

function FileDiffCard({ fileDiff }: { fileDiff: FileDiff }) {
  return (
    <div className="space-y-2 rounded-xl border border-white/5 bg-black/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileText size={12} className="shrink-0 text-zinc-400" />
          <span className="truncate text-xs font-semibold text-zinc-100">{fileDiff.path}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-500">
          {fileDiff.isNew && <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">New</span>}
          {fileDiff.isDeleted && <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-rose-300">Deleted</span>}
        </div>
      </div>
      <div className="space-y-2">
        {fileDiff.hunks.map((hunk, index) => (
          <DiffHunkBlock key={`${fileDiff.path}-${index}`} {...hunk} />
        ))}
      </div>
    </div>
  )
}

export function ApprovalWorkflow({
  requests,
  onApprove,
  onReject,
  onRequestChanges,
  emptyTitle = 'No approvals waiting',
  emptyDescription = 'Proposed agent changes will appear here for review before they are applied.',
}: ApprovalWorkflowProps): React.ReactElement {
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null)
  const [decisions, setDecisions] = useState<Record<string, ReviewDecision>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [conditions, setConditions] = useState<Record<string, string>>({})

  useEffect(() => {
    if (activeRequestId && requests.some(request => request.id === activeRequestId)) return
    setActiveRequestId(requests[0]?.id ?? null)
  }, [activeRequestId, requests])

  const activeRequest = useMemo(
    () => requests.find(request => request.id === activeRequestId) ?? requests[0] ?? null,
    [activeRequestId, requests]
  )

  const queueSummary = useMemo(() => {
    const summary = { pending: 0, approved: 0, rejected: 0, modified: 0 }
    for (const request of requests) {
      const decision = decisions[request.id] ?? 'pending'
      summary[decision] += 1
    }
    return summary
  }, [decisions, requests])

  async function submitDecision(
    request: ApprovalRequest,
    decision: ReviewDecision,
    callback?: (request: ApprovalRequest, note: string) => void | Promise<void>,
    extraConditions: string[] = []
  ) {
    const note = (notes[request.id] ?? '').trim()
    setDecisions(prev => ({ ...prev, [request.id]: decision }))

    if (decision === 'modified') {
      const nextConditions = extraConditions.length > 0 ? extraConditions : parseConditions(conditions[request.id] ?? '')
      await onRequestChanges?.(request, note, nextConditions)
      return
    }

    await callback?.(request, note)
  }

  if (requests.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/10 bg-zinc-900/20 p-6 text-center">
        <div className="max-w-xs space-y-2">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400">
            <MessageSquareMore size={18} />
          </div>
          <div className="text-sm font-semibold text-zinc-100">{emptyTitle}</div>
          <div className="text-xs leading-5 text-zinc-500">{emptyDescription}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid h-full gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col rounded-xl border border-white/5 bg-zinc-950/40">
        <div className="border-b border-white/5 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <GitBranch size={14} className="text-cyan-300" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-100">Review queue</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
              {requests.length}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase tracking-widest">
            <span className={cn('rounded-full border px-2 py-0.5', DECISION_STYLES.pending)}>{queueSummary.pending} pending</span>
            <span className={cn('rounded-full border px-2 py-0.5', DECISION_STYLES.approved)}>{queueSummary.approved} approved</span>
            <span className={cn('rounded-full border px-2 py-0.5', DECISION_STYLES.rejected)}>{queueSummary.rejected} rejected</span>
            <span className={cn('rounded-full border px-2 py-0.5', DECISION_STYLES.modified)}>{queueSummary.modified} changed</span>
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2 custom-scrollbar">
          {requests.map(request => {
            const decision = decisions[request.id] ?? 'pending'
            const isActive = request.id === activeRequest?.id

            return (
              <button
                key={request.id}
                type="button"
                onClick={() => setActiveRequestId(request.id)}
                className={cn(
                  'w-full rounded-xl border px-3 py-2 text-left transition-colors',
                  isActive ? 'border-cyan-500/30 bg-cyan-500/10' : 'border-white/5 bg-black/20 hover:bg-white/5'
                )}
                aria-pressed={isActive}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-100">{request.title}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-500">
                      <span className="truncate">{request.agentName}</span>
                      <ChevronRight size={10} className="shrink-0" />
                      <span>{formatCategory(request.category)}</span>
                    </div>
                  </div>
                  <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest', RISK_STYLES[request.risk])}>
                    {request.risk}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest', DECISION_STYLES[decision])}>
                    {DECISION_LABELS[decision]}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                    <Clock3 size={10} />
                    {formatTimestamp(request.timestamp)}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      <section className="min-h-0 rounded-xl border border-white/5 bg-zinc-950/40 p-3">
        {activeRequest ? (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-semibold text-zinc-100">{activeRequest.title}</h3>
                  <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest', RISK_STYLES[activeRequest.risk])}>
                    {activeRequest.risk}
                  </span>
                  <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest', DECISION_STYLES[decisions[activeRequest.id] ?? 'pending'])}>
                    {DECISION_LABELS[decisions[activeRequest.id] ?? 'pending']}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-400">
                  {activeRequest.agentName} proposed a {formatCategory(activeRequest.category).toLowerCase()} review for {activeRequest.agentId}.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-1.5">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-300">
                  {activeRequest.reversible ? 'Reversible' : 'Irreversible'}
                </span>
                {activeRequest.expiresAt && (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-300">
                    Expires {formatTimestamp(activeRequest.expiresAt)}
                  </span>
                )}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2 rounded-xl border border-white/5 bg-black/20 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  <MessageSquareMore size={12} />
                  Proposed change
                </div>
                <p className="text-sm leading-6 text-zinc-200">{activeRequest.description}</p>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Category</div>
                    <div className="mt-1 text-sm text-zinc-100">{formatCategory(activeRequest.category)}</div>
                  </div>
                  <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Affected paths</div>
                    <div className="mt-1 text-sm text-zinc-100">{activeRequest.affectedPaths?.length ?? 0}</div>
                  </div>
                </div>

                {activeRequest.command && (
                  <div className="space-y-1 rounded-lg border border-white/5 bg-black/30 px-3 py-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      <Code2 size={11} />
                      Command
                    </div>
                    <code className="block overflow-x-auto font-mono text-xs text-cyan-200">{activeRequest.command}</code>
                  </div>
                )}
              </div>

              <div className="space-y-2 rounded-xl border border-white/5 bg-black/20 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                  <ShieldAlert size={12} />
                  Review note
                </div>
                <textarea
                  aria-label="Review note"
                  value={notes[activeRequest.id] ?? ''}
                  onChange={(event) => setNotes(prev => ({ ...prev, [activeRequest.id]: event.target.value }))}
                  rows={4}
                  placeholder="Capture approval context, follow-up work, or rejection rationale."
                  className="min-h-[104px] w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-cyan-500/40"
                />

                <label className="block space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Request changes conditions</div>
                  <input
                    aria-label="Request changes conditions"
                    type="text"
                    value={conditions[activeRequest.id] ?? ''}
                    onChange={(event) => setConditions(prev => ({ ...prev, [activeRequest.id]: event.target.value }))}
                    placeholder="Rollback note, tests to add, split the change..."
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-amber-500/40"
                  />
                </label>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => { void submitDecision(activeRequest, 'approved', onApprove) }}
                    className="btn-primary flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 size={14} />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => { void submitDecision(activeRequest, 'rejected', onReject) }}
                    className="btn-danger flex items-center justify-center gap-1.5"
                  >
                    <XCircle size={14} />
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => { void submitDecision(activeRequest, 'modified') }}
                    className="btn-secondary flex items-center justify-center gap-1.5"
                  >
                    <AlertTriangle size={14} />
                    Request changes
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-white/5 bg-black/20 p-3 custom-scrollbar">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
                <FileText size={12} />
                Proposed diff
              </div>
              {activeRequest.fileDiffs?.length ? (
                <div className="space-y-3">
                  {activeRequest.fileDiffs.map(fileDiff => (
                    <FileDiffCard key={fileDiff.path} fileDiff={fileDiff} />
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-white/10 bg-white/5 px-3 py-4 text-sm text-zinc-500">
                  No file diff attached to this request.
                </div>
              )}

              {activeRequest.affectedPaths?.length ? (
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Affected paths</div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeRequest.affectedPaths.map(path => (
                      <span
                        key={path}
                        className="rounded-full border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] text-zinc-300"
                      >
                        {shortPath(path)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-zinc-500">
            No request selected.
          </div>
        )}
      </section>
    </div>
  )
}
