import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { GSDPhase, GSDState } from './types'
import { GSDProgress } from '../types'

export class GsdEngine {
  private state: GSDState

  constructor(projectPath: string, projectName: string) {
    this.state = {
      initialized: false,
      projectName,
      projectPath,
      phases: [],
      currentPhaseNumber: null,
      waves: []
    }
  }

  public async initialize(): Promise<void> {
    const planningDir = join(this.state.projectPath, '.planning')
    this.state.initialized = existsSync(planningDir)

    if (this.state.initialized) {
      const roadmapPath = join(planningDir, 'ROADMAP.md')
      this.parseRoadmap(roadmapPath)
    }
  }

  private parseRoadmap(roadmapPath: string): void {
    if (!existsSync(roadmapPath)) return

    try {
      const content = readFileSync(roadmapPath, 'utf-8')
      const lines = content.split('\n')

      const phasePattern = /^##\s+Phase\s+([\d.]+):\s*(.+)/i
      const completedPattern = /\[x\]|\(COMPLETED\)|\(DONE\)/i

      this.state.phases = []

      for (const line of lines) {
        const match = line.match(phasePattern)
        if (match) {
          const phaseNumStr = match[1]
          const phaseNum = parseFloat(phaseNumStr)
          const title = match[2].trim()
          const completed = completedPattern.test(line)

          this.state.phases.push({
            number: phaseNum,
            title: title.replace(completedPattern, '').trim(),
            status: completed ? 'completed' : 'pending',
            tasks: [],
            dependencies: []
          })
        }
      }

      // Find current phase (first non-completed)
      const currentPhaseObj = this.state.phases.find(p => p.status !== 'completed')
      if (currentPhaseObj) {
        this.state.currentPhaseNumber = currentPhaseObj.number
        currentPhaseObj.status = 'in_progress'
      } else if (this.state.phases.length > 0) {
        const lastPhase = this.state.phases[this.state.phases.length - 1]
        this.state.currentPhaseNumber = lastPhase.number
      }
    } catch (e) {
      console.error('Failed to parse roadmap:', e)
    }
  }

  public getProgress(): GSDProgress {
    const completedCount = this.state.phases.filter(p => p.status === 'completed').length
    
    return {
      initialized: this.state.initialized,
      currentPhase: this.state.phases.find(p => p.number === this.state.currentPhaseNumber)?.title || null,
      currentPhaseNumber: this.state.currentPhaseNumber,
      totalPhases: this.state.phases.length,
      completedPhases: completedCount,
      phases: this.state.phases.map(p => ({
        number: p.number,
        title: p.title,
        completed: p.status === 'completed'
      }))
    }
  }

  public async startPhase(phaseNumber: number): Promise<void> {
    const phase = this.state.phases.find(p => p.number === phaseNumber)
    if (!phase) throw new Error(`Phase ${phaseNumber} not found`)
    
    phase.status = 'in_progress'
    this.state.currentPhaseNumber = phaseNumber
  }

  public async completePhase(phaseNumber: number): Promise<void> {
    const phase = this.state.phases.find(p => p.number === phaseNumber)
    if (!phase) throw new Error(`Phase ${phaseNumber} not found`)
    
    phase.status = 'completed'
    
    const next = this.state.phases.find(p => p.number > phaseNumber && p.status === 'pending')
    if (next) {
      this.state.currentPhaseNumber = next.number
      next.status = 'in_progress'
    } else {
      this.state.currentPhaseNumber = null
    }
  }
}
