import { renderHook, act, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSwarmSnapshots } from './useSwarmSnapshots'

vi.mock('../api', () => ({
  getApi: vi.fn(),
}))

import { getApi } from '../api'

const mockApi = {
  gsdGetSwarmSnapshots: vi.fn(),
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(getApi).mockReturnValue(mockApi as any)
})

describe('useSwarmSnapshots', () => {
  it('fetches snapshots on mount', async () => {
    const snapshots = [{ id: 's1', name: 'snap1' }]
    mockApi.gsdGetSwarmSnapshots.mockResolvedValue(snapshots)

    const { result } = renderHook(() => useSwarmSnapshots('/repo'))

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.snapshots).toEqual(snapshots)
    expect(result.current.error).toBeNull()
    expect(mockApi.gsdGetSwarmSnapshots).toHaveBeenCalledWith('/repo')
  })

  it('sets error on fetch failure', async () => {
    mockApi.gsdGetSwarmSnapshots.mockRejectedValue(new Error('fetch failed'))

    const { result } = renderHook(() => useSwarmSnapshots('/repo'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toContain('fetch failed')
    expect(result.current.snapshots).toEqual([])
  })

  it('skips fetch when projectPath is empty', async () => {
    const { result } = renderHook(() => useSwarmSnapshots(''))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockApi.gsdGetSwarmSnapshots).not.toHaveBeenCalled()
    expect(result.current.snapshots).toEqual([])
  })

  it('does not fetch when api is null', async () => {
    vi.mocked(getApi).mockReturnValue(null)

    const { result } = renderHook(() => useSwarmSnapshots('/repo'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.snapshots).toEqual([])
    expect(result.current.error).toBeNull()
  })

  it('refresh re-fetches snapshots', async () => {
    const first = [{ id: 's1' }]
    const second = [{ id: 's1' }, { id: 's2' }]
    mockApi.gsdGetSwarmSnapshots
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second)

    const { result } = renderHook(() => useSwarmSnapshots('/repo'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.snapshots).toEqual(first)

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.snapshots).toEqual(second)
    expect(mockApi.gsdGetSwarmSnapshots).toHaveBeenCalledTimes(2)
  })
})
