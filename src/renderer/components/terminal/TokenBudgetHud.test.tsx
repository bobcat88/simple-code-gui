import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TokenBudgetHud } from './TokenBudgetHud'
import type { TokenSessionMetrics } from './useTokenMeter'

describe('TokenBudgetHud', () => {
  it('renders current burn, cost, and budget status', () => {
    const snapshot: TokenSessionMetrics = {
      inputTokens: 1200,
      outputTokens: 300,
      savedTokens: 90,
      costEstimate: 0.045,
      eventCount: 2,
      lastUpdatedAt: 1710000000000,
    }

    render(
      <TokenBudgetHud
        snapshot={snapshot}
        guardrails={{ tokenBudget: 1600, costBudget: 0.05 }}
      />,
    )

    expect(screen.getByTitle('Current session burn').textContent).toMatch(/Burn\s*1[.,]5\s*k\s*tokens/i)
    expect(screen.getByTitle('Estimated session cost')).toHaveTextContent('$0.045')
    expect(screen.getByTitle('Budget status').textContent).toContain('Near budget')
    expect(screen.getByTitle('Measured optimization savings')).toHaveTextContent('0 saved')
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders measured optimization savings when available', () => {
    const snapshot: TokenSessionMetrics = {
      inputTokens: 1200,
      outputTokens: 300,
      savedTokens: 90,
      costEstimate: 0.045,
      eventCount: 2,
      lastUpdatedAt: 1710000000000,
    }

    render(
      <TokenBudgetHud
        snapshot={snapshot}
        optimizationStats={{
          aggregate: {
            provider: null,
            rawTokens: 1900,
            optimizedTokens: 1500,
            savedTokens: 400,
            cacheHits: 0,
            cacheMisses: 0,
            compressions: 1,
            reasoningRequests: 0,
            fimRequests: 0,
            semanticHits: 0,
            semanticMisses: 0,
            transactionCount: 2,
          },
          session: {
            provider: null,
            rawTokens: 1900,
            optimizedTokens: 1500,
            savedTokens: 400,
            cacheHits: 0,
            cacheMisses: 0,
            compressions: 1,
            reasoningRequests: 0,
            fimRequests: 0,
            semanticHits: 0,
            semanticMisses: 0,
            transactionCount: 2,
          },
          providerBreakdown: [],
        }}
      />,
    )

    expect(screen.getByTitle('Measured optimization savings')).toHaveTextContent(/400\s*\/\s*1[.,]9\s*k/i)
  })
})
