import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useTelemetryCapture } from '../useTelemetryCapture'
import { useTelemetryStore } from '../../../stores/telemetry'

// Mock the store
vi.mock('../../../stores/telemetry', () => ({
  useTelemetryStore: vi.fn(),
}))

describe('useTelemetryCapture', () => {
  const addUsage = vi.fn()
  const ptyId = 'test-pty'

  beforeEach(() => {
    vi.clearAllMocks()
    // Setup the mock to return addUsage when useTelemetryStore is called with the selector
    ;(useTelemetryStore as any).mockImplementation((selector: any) => selector({ addUsage }))
  })

  it('should parse Aider token and cost format', () => {
    // AC: @token-economics ac-1
    const { result } = renderHook(() => useTelemetryCapture({ ptyId }))
    
    result.current.processTelemetryChunk('Tokens: 1,200 prompt, 300 completion, 1,500 total. Cost: $0.0150.\n')
    
    expect(addUsage).toHaveBeenCalledWith(ptyId, {
      tokens: { prompt: 1200, completion: 300, total: 1500 },
      cost: 0.0150
    })
  })

  it('should parse RTK saved tokens', () => {
    // AC: @token-economics ac-3
    const { result } = renderHook(() => useTelemetryCapture({ ptyId }))
    
    result.current.processTelemetryChunk('Saved Tokens: 5,432\n')
    
    expect(addUsage).toHaveBeenCalledWith(ptyId, {
      tokensSaved: 5432
    })
  })

  it('should parse MCP savings', () => {
    const { result } = renderHook(() => useTelemetryCapture({ ptyId }))
    
    result.current.processTelemetryChunk('[MCP] Savings: 1,000 tokens\n')
    
    expect(addUsage).toHaveBeenCalledWith(ptyId, {
      tokensSaved: 1000
    })
  })

  it('should parse cache hits', () => {
    const { result } = renderHook(() => useTelemetryCapture({ ptyId }))
    
    result.current.processTelemetryChunk('Cache hits: 5\n')
    
    expect(addUsage).toHaveBeenCalledWith(ptyId, {
      cacheHits: 5
    })
  })

  it('should handle chunked data correctly', () => {
    // AC: @token-economics ac-1
    const { result } = renderHook(() => useTelemetryCapture({ ptyId }))
    
    result.current.processTelemetryChunk('Tokens: 100 prompt, ')
    expect(addUsage).not.toHaveBeenCalled()
    
    result.current.processTelemetryChunk('50 completion, 150 total\n')
    expect(addUsage).toHaveBeenCalledWith(ptyId, {
      tokens: { prompt: 100, completion: 50, total: 150 }
    })
  })
})
