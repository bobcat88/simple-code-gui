import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Database = require('better-sqlite3')

export interface TelemetryRecord {
  id?: number
  timestamp?: string
  ptyId: string
  projectPath: string
  backend: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number
  savings: number
  tokensSaved: number
  cacheHits: number
}

export class TelemetryDb {
  private db: any

  constructor() {
    const configDir = join(app.getPath('userData'), 'db')
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true })
    }
    const dbPath = join(configDir, 'telemetry.db')
    this.db = new Database(dbPath)
    this.init()
  }

  private init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        ptyId TEXT,
        projectPath TEXT,
        backend TEXT,
        promptTokens INTEGER DEFAULT 0,
        completionTokens INTEGER DEFAULT 0,
        totalTokens INTEGER DEFAULT 0,
        cost REAL DEFAULT 0,
        savings REAL DEFAULT 0,
        tokensSaved INTEGER DEFAULT 0,
        cacheHits INTEGER DEFAULT 0
      )
    `)
    
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_telemetry_ptyId ON telemetry(ptyId)`)
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_telemetry_projectPath ON telemetry(projectPath)`)
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry(timestamp)`)
  }

  addRecord(record: TelemetryRecord) {
    const stmt = this.db.prepare(`
      INSERT INTO telemetry (
        ptyId, projectPath, backend, promptTokens, completionTokens, 
        totalTokens, cost, savings, tokensSaved, cacheHits
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    return stmt.run(
      record.ptyId,
      record.projectPath,
      record.backend,
      record.promptTokens,
      record.completionTokens,
      record.totalTokens,
      record.cost,
      record.savings,
      record.tokensSaved,
      record.cacheHits
    )
  }

  getStats(projectPath?: string) {
    return this.getStatsForPeriod(projectPath, 'total')
  }

  getStatsForPeriod(projectPath?: string, period: 'daily' | 'monthly' | 'total' = 'total') {
    let query = `
      SELECT 
        COALESCE(SUM(promptTokens), 0) as prompt,
        COALESCE(SUM(completionTokens), 0) as completion,
        COALESCE(SUM(totalTokens), 0) as total,
        COALESCE(SUM(cost), 0) as cost,
        COALESCE(SUM(savings), 0) as savings,
        COALESCE(SUM(tokensSaved), 0) as tokensSaved,
        COALESCE(SUM(cacheHits), 0) as cacheHits
      FROM telemetry
    `
    const conditions: string[] = []
    const params: any[] = []

    if (projectPath) {
      conditions.push(`projectPath = ?`)
      params.push(projectPath)
    }

    if (period === 'daily') {
      conditions.push(`timestamp >= date('now', 'start of day')`)
    } else if (period === 'monthly') {
      conditions.push(`timestamp >= date('now', 'start of month')`)
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ')
    }

    return this.db.prepare(query).get(...params)
  }

  getHistory(limit = 100) {
    return this.db.prepare(`
      SELECT * FROM telemetry ORDER BY timestamp DESC LIMIT ?
    `).all(limit)
  }

  clear() {
    this.db.exec(`DELETE FROM telemetry`)
  }
}

export const telemetryDb = new TelemetryDb()
