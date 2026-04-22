import React from 'react'
import { Coins, Cpu, Gauge } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { TokenSessionMetrics } from './useTokenMeter'
import {
  createTokenBudgetSnapshot,
  DEFAULT_TOKEN_GUARDRAILS,
  formatCompactNumber,
  type TokenBudgetGuardrails,
} from './tokenHud'

interface TokenBudgetHudProps {
  snapshot: TokenSessionMetrics
  guardrails?: TokenBudgetGuardrails
  className?: string
}

const STATUS_STYLES: Record<'idle' | 'healthy' | 'watch' | 'critical' | 'over', string> = {
  idle: 'text-white/45',
  healthy: 'text-emerald-300',
  watch: 'text-amber-300',
  critical: 'text-orange-300',
  over: 'text-rose-300',
}

export function TokenBudgetHud({ snapshot, guardrails = DEFAULT_TOKEN_GUARDRAILS, className }: TokenBudgetHudProps): React.ReactElement {
  const derived = createTokenBudgetSnapshot(snapshot, guardrails)
  const statusClass = STATUS_STYLES[derived.budgetStatus]

  return (
    <div
      className={cn(
        'pointer-events-none w-full max-w-[24rem] rounded-full border border-white/10 bg-black/45 px-3 py-2 text-[10px] shadow-lg backdrop-blur-md',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex items-center gap-1.5 whitespace-nowrap" title="Current session burn">
          <Cpu size={12} className="text-indigo-300" />
          <span className="text-white/55">Burn</span>
          <span className="font-semibold text-white/90">{formatCompactNumber(derived.totalTokens)} tokens</span>
        </div>

        <div className="h-3 w-px bg-white/10" />

        <div className="flex items-center gap-1.5 whitespace-nowrap" title="Estimated session cost">
          <Coins size={12} className="text-amber-300" />
          <span className="text-white/55">Cost</span>
          <span className="font-semibold text-white/90">${derived.costEstimate.toFixed(3)}</span>
        </div>

        <div className="h-3 w-px bg-white/10" />

        <div className="flex items-center gap-1.5 whitespace-nowrap" title="Budget status">
          <Gauge size={12} className={statusClass} />
          <span className="text-white/55">Budget</span>
          <span className={cn('font-semibold', statusClass)}>{derived.budgetLabel}</span>
          <span className="text-white/50">{Math.min(100, Math.round(derived.burnRatio * 100))}%</span>
        </div>
      </div>

      <div className="mt-2 h-1 rounded-full bg-white/10" aria-hidden="true">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            derived.budgetStatus === 'over' ? 'bg-rose-400' :
            derived.budgetStatus === 'critical' ? 'bg-orange-400' :
            derived.budgetStatus === 'watch' ? 'bg-amber-400' :
            derived.budgetStatus === 'healthy' ? 'bg-emerald-400' :
            'bg-white/20',
          )}
          style={{ width: `${Math.min(100, Math.max(0, derived.burnRatio * 100))}%` }}
        />
      </div>
    </div>
  )
}
