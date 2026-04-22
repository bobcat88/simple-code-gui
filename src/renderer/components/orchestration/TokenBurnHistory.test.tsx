import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TokenBurnHistory } from './TokenBurnHistory'
import type { Api, TokenHistoryResponse } from '../../api/types'

const history: TokenHistoryResponse = {
  totals: {
    inputTokens: 1200,
    outputTokens: 300,
    costEstimate: 0.045,
    transactionCount: 2,
  },
  sessions: [
    {
      sessionId: 'pty-1',
      projectPath: '/workspace/simple-code-gui',
      backend: 'codex',
      inputTokens: 1200,
      outputTokens: 300,
      costEstimate: 0.045,
      firstTimestamp: '2026-04-21 10:00:00',
      lastTimestamp: '2026-04-21 10:05:00',
      transactionCount: 2,
    },
  ],
  projectBreakdown: [
    {
      key: '/workspace/simple-code-gui',
      inputTokens: 1200,
      outputTokens: 300,
      costEstimate: 0.045,
    },
  ],
  backendBreakdown: [
    {
      key: 'codex',
      inputTokens: 1200,
      outputTokens: 300,
      costEstimate: 0.045,
    },
  ],
  daily: [
    {
      date: '2026-04-21',
      inputTokens: 1200,
      outputTokens: 300,
      costEstimate: 0.045,
    },
  ],
}

describe('TokenBurnHistory', () => {
  it('renders totals, chart data, and project/backend breakdowns', async () => {
    // AC: @01KPNWTT ac-4
    const api = {
      getTokenHistory: vi.fn().mockResolvedValue(history),
    } as unknown as Api

    render(<TokenBurnHistory api={api} />)

    await waitFor(() => expect(api.getTokenHistory).toHaveBeenCalled())

    expect(screen.getAllByText('1.5K').length).toBeGreaterThan(0)
    expect(screen.getByText('$0.045')).toBeInTheDocument()
    expect(screen.getAllByText('simple-code-gui').length).toBeGreaterThan(0)
    expect(screen.getAllByText('codex').length).toBeGreaterThan(0)
    expect(screen.getByTitle('2026-04-21: 1,500 tokens')).toBeInTheDocument()
  })
})
