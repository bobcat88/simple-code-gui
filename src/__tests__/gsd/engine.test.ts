import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GsdEngine } from '../../server/gsd/engine'

// Mocking the entire fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn()
}))

import * as fs from 'fs'

describe('GsdEngine', () => {
  const projectPath = '/test/project'
  const projectName = 'TestProject'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should report not initialized if .planning missing', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false)
    
    const engine = new GsdEngine(projectPath, projectName)
    await engine.initialize()
    
    const progress = engine.getProgress()
    expect(progress.initialized).toBe(false)
  })

  it('should parse roadmap if .planning exists', async () => {
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      const pathStr = String(p)
      if (pathStr.includes('.planning')) return true
      if (pathStr.includes('ROADMAP.md')) return true
      return false
    })
    
    const roadmapContent = `
# Roadmap
## Phase 1: [x] Discovery
## Phase 2: Architecture
## Phase 3: Implementation
`
    vi.mocked(fs.readFileSync).mockReturnValue(roadmapContent)
    
    const engine = new GsdEngine(projectPath, projectName)
    await engine.initialize()
    
    const progress = engine.getProgress()
    expect(progress.initialized).toBe(true)
    expect(progress.totalPhases).toBe(3)
    expect(progress.completedPhases).toBe(1)
    expect(progress.currentPhaseNumber).toBe(2)
  })
})
