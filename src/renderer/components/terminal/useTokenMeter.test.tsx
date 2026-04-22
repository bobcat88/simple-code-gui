import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useTokenMeter } from './useTokenMeter'
import type { ExtendedApi } from '../../api/types'

describe('useTokenMeter', () => {
  it('accumulates live session totals and suppresses duplicate logs', async () => {
    const api = {
      logTokenEvent: vi.fn().mockResolvedValue(undefined),
    } as unknown as ExtendedApi

    const { result, rerender } = renderHook(
      ({ ptyId }) => useTokenMeter({
        ptyId,
        api,
        projectPath: '/workspace/simple-code-gui',
        backend: 'codex',
      }),
      {
        initialProps: { ptyId: 'pty-1' },
      },
    )

    act(() => {
      result.current.processTokenChunk('Tokens: 120 input, 30 output Saved: 20 Cost: $0.045')
    })

    await waitFor(() => expect(api.logTokenEvent).toHaveBeenCalledTimes(1))
    expect(result.current.snapshot).toMatchObject({
      inputTokens: 120,
      outputTokens: 30,
      savedTokens: 20,
      costEstimate: 0.045,
      eventCount: 1,
    })

    act(() => {
      result.current.processTokenChunk('Tokens: 120 input, 30 output Saved: 20 Cost: $0.045')
    })

    expect(api.logTokenEvent).toHaveBeenCalledTimes(1)
    expect(result.current.snapshot).toMatchObject({
      inputTokens: 120,
      outputTokens: 30,
      savedTokens: 20,
      costEstimate: 0.045,
      eventCount: 1,
    })

    rerender({ ptyId: 'pty-2' })

    await waitFor(() => expect(result.current.snapshot).toMatchObject({
      inputTokens: 0,
      outputTokens: 0,
      savedTokens: 0,
      costEstimate: 0,
      eventCount: 0,
    }))
  })
})
