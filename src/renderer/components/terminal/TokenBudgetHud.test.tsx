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

    expect(screen.getByTitle('Current session burn')).toHaveTextContent('1.5K tokens')
    expect(screen.getByTitle('Estimated session cost')).toHaveTextContent('$0.045')
    expect(screen.getByTitle('Budget status').textContent).toContain('Near budget')
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
