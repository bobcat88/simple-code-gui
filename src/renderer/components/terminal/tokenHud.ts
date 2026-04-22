import type { TokenSessionMetrics } from './useTokenMeter'

export interface TokenBudgetGuardrails {
  tokenBudget: number
  costBudget: number
}

export type TokenBudgetStatus = 'idle' | 'healthy' | 'watch' | 'critical' | 'over'

export interface TokenBudgetSnapshot extends TokenSessionMetrics {
  totalTokens: number
  burnRatio: number
  budgetStatus: TokenBudgetStatus
  budgetLabel: string
}

export const DEFAULT_TOKEN_GUARDRAILS: TokenBudgetGuardrails = {
  tokenBudget: 15000,
  costBudget: 0.5,
}

export function formatCompactNumber(value: number): string {
  return Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function createTokenBudgetSnapshot(
  metrics: TokenSessionMetrics,
  guardrails: TokenBudgetGuardrails = DEFAULT_TOKEN_GUARDRAILS,
): TokenBudgetSnapshot {
  const totalTokens = metrics.inputTokens + metrics.outputTokens
  const tokenRatio = guardrails.tokenBudget > 0 ? totalTokens / guardrails.tokenBudget : 0
  const costRatio = guardrails.costBudget > 0 ? metrics.costEstimate / guardrails.costBudget : 0
  const burnRatio = Math.max(tokenRatio, costRatio)

  let budgetStatus: TokenBudgetStatus = 'idle'
  if (metrics.eventCount > 0 || totalTokens > 0 || metrics.costEstimate > 0) {
    if (burnRatio >= 1) {
      budgetStatus = 'over'
    } else if (burnRatio >= 0.85) {
      budgetStatus = 'critical'
    } else if (burnRatio >= 0.6) {
      budgetStatus = 'watch'
    } else {
      budgetStatus = 'healthy'
    }
  }

  const budgetLabel = {
    idle: 'Idle',
    healthy: 'On track',
    watch: 'Watching',
    critical: 'Near budget',
    over: 'Over budget',
  }[budgetStatus]

  return {
    ...metrics,
    totalTokens,
    burnRatio,
    budgetStatus,
    budgetLabel,
  }
}
