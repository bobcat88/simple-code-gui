import { describe, it, expect } from 'vitest'
import { parseTokenUsage, TokenAccumulator } from '../telemetry/token-parser'

// AC: @token-economics ac-1
describe('parseTokenUsage', () => {
  it('parses Claude-style "input/output" token counts', () => {
    const result = parseTokenUsage('1234 input / 567 output', 'claude')
    expect(result).not.toBeNull()
    expect(result!.inputTokens).toBe(1234)
    expect(result!.outputTokens).toBe(567)
    expect(result!.totalTokens).toBe(1801)
  })

  it('parses K-suffix token counts', () => {
    const result = parseTokenUsage('1.2K input / 345 output', 'claude')
    expect(result).not.toBeNull()
    expect(result!.inputTokens).toBe(1200)
    expect(result!.outputTokens).toBe(345)
  })

  it('parses M-suffix token counts', () => {
    const result = parseTokenUsage('1.5M input / 200K output', 'claude')
    expect(result).not.toBeNull()
    expect(result!.inputTokens).toBe(1500000)
    expect(result!.outputTokens).toBe(200000)
  })

  it('parses "Input tokens: X, Output tokens: Y" format', () => {
    const result = parseTokenUsage('Input tokens: 5000, Output tokens: 1500', 'claude')
    expect(result).not.toBeNull()
    expect(result!.inputTokens).toBe(5000)
    expect(result!.outputTokens).toBe(1500)
  })

  it('parses cost from "Total cost: $0.42"', () => {
    const result = parseTokenUsage('Input tokens: 5000, Output tokens: 1500\nTotal cost: $0.42', 'claude')
    expect(result).not.toBeNull()
    expect(result!.cost).toBe(0.42)
  })

  it('returns null for no token data', () => {
    const result = parseTokenUsage('Hello world, no tokens here', 'claude')
    expect(result).toBeNull()
  })

  it('strips ANSI escape codes before parsing', () => {
    const ansi = '\x1b[32m1234 input / 567 output\x1b[0m'
    const result = parseTokenUsage(ansi, 'claude')
    expect(result).not.toBeNull()
    expect(result!.inputTokens).toBe(1234)
  })

  it('parses Gemini-style "prompt tokens / candidates tokens"', () => {
    const result = parseTokenUsage('prompt tokens: 3000, candidates tokens: 800', 'gemini')
    expect(result).not.toBeNull()
    expect(result!.inputTokens).toBe(3000)
    expect(result!.outputTokens).toBe(800)
  })

  it('parses Aider-style "Tokens: X sent, Y received"', () => {
    const result = parseTokenUsage('Tokens: 2.5K sent, 1.2K received', 'aider')
    expect(result).not.toBeNull()
    expect(result!.inputTokens).toBe(2500)
    expect(result!.outputTokens).toBe(1200)
  })

  it('includes timestamp and backend in result', () => {
    const before = Date.now()
    const result = parseTokenUsage('1234 input / 567 output', 'claude')
    expect(result).not.toBeNull()
    expect(result!.timestamp).toBeGreaterThanOrEqual(before)
    expect(result!.backend).toBe('claude')
  })
})

// AC: @token-economics ac-1
describe('TokenAccumulator', () => {
  it('accumulates data and parses on newlines', () => {
    const acc = new TokenAccumulator('claude')
    // Partial data — no newline yet
    expect(acc.append('1234 input / 567 out')).toBeNull()
    // Complete line
    const result = acc.append('put\n')
    expect(result).not.toBeNull()
    expect(result!.inputTokens).toBe(1234)
    expect(result!.outputTokens).toBe(567)
  })

  it('clears buffer after successful parse', () => {
    const acc = new TokenAccumulator('claude')
    acc.append('1234 input / 567 output\n')
    // Next parse should not find old data
    expect(acc.append('no tokens here\n')).toBeNull()
  })

  it('handles backend switching', () => {
    const acc = new TokenAccumulator('claude')
    acc.setBackend('gemini')
    acc.append('prompt tokens: 3000, candidates tokens: 800\n')
    // Should parse as gemini format
    // (buffer was cleared on parse, so we check accumulator works with new backend)
  })
})
