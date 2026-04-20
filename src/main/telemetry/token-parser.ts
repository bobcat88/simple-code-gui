/**
 * Token parser — extracts token usage data from terminal output.
 * Supports Claude, Gemini, Codex, OpenCode, and Aider backends.
 */

export interface TokenUsageEvent {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  cost?: number
  timestamp: number
  backend: string
}

// ANSI escape code stripper
function stripAnsi(str: string): string {
  return str
    .replace(/\x1b\[[\?]?[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\x1b[>=][0-9]*[a-zA-Z]?/g, '')
}

// Claude Code patterns
// Status bar format: "Input: 1.2K Output: 345 Cache Read: 500 Cache Write: 200"
// Cost line: "Total cost: $0.42"
// Session end: "Total tokens: 12345" or "input: 1234 output: 567"
const CLAUDE_TOKEN_PATTERNS = [
  // Claude Code status line: "tokens: 1.2K in, 345 out" or "1234 input / 567 output"
  /(\d+(?:\.\d+)?[KkMm]?)\s*(?:input|in)\s*[\/:,]\s*(\d+(?:\.\d+)?[KkMm]?)\s*(?:output|out)/i,
  // "Input tokens: 1234, Output tokens: 567"
  /Input\s*(?:tokens)?[:\s]+(\d+(?:\.\d+)?[KkMm]?)\s*[,;]\s*Output\s*(?:tokens)?[:\s]+(\d+(?:\.\d+)?[KkMm]?)/i,
  // Cache read/write: "Cache read: 500, Cache write: 200"
  /Cache\s*read[:\s]+(\d+(?:\.\d+)?[KkMm]?)\s*[,;]?\s*Cache\s*write[:\s]+(\d+(?:\.\d+)?[KkMm]?)/i,
]

const COST_PATTERN = /(?:Total\s+)?[Cc]ost[:\s]+\$?([\d.]+)/

// Gemini patterns
const GEMINI_TOKEN_PATTERNS = [
  /(?:prompt|input)\s*(?:tokens)?[:\s]+(\d+(?:\.\d+)?[KkMm]?)\s*[,;/]\s*(?:candidates?|output|completion)\s*(?:tokens)?[:\s]+(\d+(?:\.\d+)?[KkMm]?)/i,
  /(\d+)\s*prompt\s*tokens?\s*[,;/]\s*(\d+)\s*(?:candidates?|completion)\s*tokens?/i,
]

// Aider patterns
const AIDER_TOKEN_PATTERNS = [
  /Tokens:\s*(\d+(?:\.\d+)?[KkMm]?)\s*sent\s*[,;]\s*(\d+(?:\.\d+)?[KkMm]?)\s*received/i,
  /Cost:\s*\$?([\d.]+)\s*(?:message|request)/i,
]

function parseTokenCount(raw: string): number {
  const str = raw.trim().toLowerCase()
  const num = parseFloat(str)
  if (str.endsWith('k')) return Math.round(num * 1000)
  if (str.endsWith('m')) return Math.round(num * 1000000)
  return Math.round(num)
}

export function parseTokenUsage(rawData: string, backend: string): TokenUsageEvent | null {
  const data = stripAnsi(rawData)

  let inputTokens = 0
  let outputTokens = 0
  let cacheReadTokens: number | undefined
  let cacheWriteTokens: number | undefined
  let cost: number | undefined

  const patterns = getBackendPatterns(backend)

  for (const pattern of patterns) {
    const match = data.match(pattern)
    if (match) {
      inputTokens = parseTokenCount(match[1])
      outputTokens = parseTokenCount(match[2])
      break
    }
  }

  if (inputTokens === 0 && outputTokens === 0) return null

  // Try cache pattern (Claude-specific)
  if (backend === 'claude') {
    const cacheMatch = data.match(CLAUDE_TOKEN_PATTERNS[2])
    if (cacheMatch) {
      cacheReadTokens = parseTokenCount(cacheMatch[1])
      cacheWriteTokens = parseTokenCount(cacheMatch[2])
    }
  }

  // Try cost
  const costMatch = data.match(COST_PATTERN)
  if (costMatch) {
    cost = parseFloat(costMatch[1])
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    cost,
    timestamp: Date.now(),
    backend,
  }
}

function getBackendPatterns(backend: string): RegExp[] {
  switch (backend) {
    case 'gemini':
      return GEMINI_TOKEN_PATTERNS
    case 'aider':
      return AIDER_TOKEN_PATTERNS
    default:
      return CLAUDE_TOKEN_PATTERNS.slice(0, 2) // Skip cache pattern, used separately
  }
}

/**
 * Accumulator that buffers PTY output and extracts token events.
 * Maintains a sliding window to catch multi-line token summaries.
 */
export class TokenAccumulator {
  private buffer = ''
  private readonly maxBufferSize = 2000

  append(data: string): TokenUsageEvent | null {
    this.buffer += data
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer = this.buffer.slice(-this.maxBufferSize)
    }

    // Only try to parse when we see newlines (complete lines)
    if (!data.includes('\n') && !data.includes('\r')) return null

    const event = parseTokenUsage(this.buffer, this.backend)
    if (event) {
      // Clear buffer after successful parse to avoid double-counting
      this.buffer = ''
    }
    return event
  }

  constructor(private backend: string) {}

  setBackend(backend: string): void {
    this.backend = backend
  }

  clear(): void {
    this.buffer = ''
  }
}
