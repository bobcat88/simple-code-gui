/**
 * Telemetry store — persists token usage data per session.
 * In-memory with periodic flush to disk.
 */

import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { join } from 'path'
import type { TokenUsageEvent } from './token-parser'

export interface SessionTelemetry {
  sessionId: string
  ptyId: string
  projectPath: string
  backend: string
  startedAt: number
  lastUpdatedAt: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCacheReadTokens: number
  totalCacheWriteTokens: number
  estimatedCost: number
  eventCount: number
}

export interface RtkSavings {
  totalSaved: number
  percentSaved: number
  commandCount: number
  lastUpdated: number
}

export interface TelemetrySummary {
  sessions: SessionTelemetry[]
  aggregate: {
    totalTokens: number
    totalInputTokens: number
    totalOutputTokens: number
    totalCacheReadTokens: number
    totalCacheWriteTokens: number
    estimatedCost: number
    sessionCount: number
  }
  rtkSavings: RtkSavings | null
}

// Cost per token estimates (USD)
const COST_PER_INPUT_TOKEN: Record<string, number> = {
  claude: 0.000003,   // $3/MTok
  gemini: 0.0000001,  // $0.10/MTok (Flash)
  codex: 0.000003,
  opencode: 0.000003,
  aider: 0.000003,
}

const COST_PER_OUTPUT_TOKEN: Record<string, number> = {
  claude: 0.000015,   // $15/MTok
  gemini: 0.0000004,  // $0.40/MTok (Flash)
  codex: 0.000015,
  opencode: 0.000015,
  aider: 0.000015,
}

function estimateCost(inputTokens: number, outputTokens: number, backend: string): number {
  const inputRate = COST_PER_INPUT_TOKEN[backend] || COST_PER_INPUT_TOKEN.claude
  const outputRate = COST_PER_OUTPUT_TOKEN[backend] || COST_PER_OUTPUT_TOKEN.claude
  return inputTokens * inputRate + outputTokens * outputRate
}

export class TelemetryStore {
  private sessions = new Map<string, SessionTelemetry>()
  private rtkSavings: RtkSavings | null = null
  private configPath: string
  private dirty = false
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private listeners = new Set<(summary: TelemetrySummary) => void>()

  constructor() {
    const configDir = join(app.getPath('userData'), 'config')
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true })
    }
    this.configPath = join(configDir, 'telemetry.json')
    this.load()

    // Flush to disk every 30 seconds if dirty
    this.flushTimer = setInterval(() => {
      if (this.dirty) this.save()
    }, 30000)
  }

  private load(): void {
    try {
      if (!existsSync(this.configPath)) return
      const content = readFileSync(this.configPath, 'utf-8')
      const data = JSON.parse(content)
      if (data.sessions) {
        for (const s of data.sessions) {
          this.sessions.set(s.ptyId, s)
        }
      }
      if (data.rtkSavings) {
        this.rtkSavings = data.rtkSavings
      }
    } catch (e) {
      console.error('[TelemetryStore] Failed to load:', e)
    }
  }

  private save(): void {
    try {
      const data = {
        sessions: Array.from(this.sessions.values()),
        rtkSavings: this.rtkSavings,
      }
      const json = JSON.stringify(data, null, 2)
      const tmpPath = this.configPath + '.tmp'
      writeFileSync(tmpPath, json)
      renameSync(tmpPath, this.configPath)
      this.dirty = false
    } catch (e) {
      console.error('[TelemetryStore] Failed to save:', e)
    }
  }

  recordTokenEvent(ptyId: string, projectPath: string, backend: string, event: TokenUsageEvent): void {
    let session = this.sessions.get(ptyId)
    if (!session) {
      session = {
        sessionId: ptyId,
        ptyId,
        projectPath,
        backend,
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalCacheReadTokens: 0,
        totalCacheWriteTokens: 0,
        estimatedCost: 0,
        eventCount: 0,
      }
      this.sessions.set(ptyId, session)
    }

    session.totalInputTokens += event.inputTokens
    session.totalOutputTokens += event.outputTokens
    session.totalTokens += event.totalTokens
    if (event.cacheReadTokens) session.totalCacheReadTokens += event.cacheReadTokens
    if (event.cacheWriteTokens) session.totalCacheWriteTokens += event.cacheWriteTokens
    session.estimatedCost += event.cost ?? estimateCost(event.inputTokens, event.outputTokens, backend)
    session.eventCount++
    session.lastUpdatedAt = Date.now()
    this.dirty = true

    this.notifyListeners()
  }

  updateRtkSavings(savings: RtkSavings): void {
    this.rtkSavings = savings
    this.dirty = true
    this.notifyListeners()
  }

  getSessionTelemetry(ptyId: string): SessionTelemetry | undefined {
    return this.sessions.get(ptyId)
  }

  getSummary(): TelemetrySummary {
    const sessions = Array.from(this.sessions.values())
    const aggregate = {
      totalTokens: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheWriteTokens: 0,
      estimatedCost: 0,
      sessionCount: sessions.length,
    }

    for (const s of sessions) {
      aggregate.totalTokens += s.totalTokens
      aggregate.totalInputTokens += s.totalInputTokens
      aggregate.totalOutputTokens += s.totalOutputTokens
      aggregate.totalCacheReadTokens += s.totalCacheReadTokens
      aggregate.totalCacheWriteTokens += s.totalCacheWriteTokens
      aggregate.estimatedCost += s.estimatedCost
    }

    return { sessions, aggregate, rtkSavings: this.rtkSavings }
  }

  removeSession(ptyId: string): void {
    this.sessions.delete(ptyId)
    this.dirty = true
  }

  onUpdate(listener: (summary: TelemetrySummary) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notifyListeners(): void {
    const summary = this.getSummary()
    for (const listener of this.listeners) {
      try { listener(summary) } catch (e) { /* ignore */ }
    }
  }

  dispose(): void {
    if (this.flushTimer) clearInterval(this.flushTimer)
    if (this.dirty) this.save()
    this.listeners.clear()
  }
}
