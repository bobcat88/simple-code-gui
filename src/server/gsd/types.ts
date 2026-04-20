import { GSDProgress } from '../types'

export interface GSDPhase {
  number: number
  title: string
  description?: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  tasks: string[] // Task IDs or summaries
  dependencies: number[] // Phase numbers
}

export interface GSDWave {
  id: string
  phaseNumbers: number[]
  status: 'pending' | 'executing' | 'completed'
}

export interface GSDState {
  initialized: boolean
  projectName: string
  projectPath: string
  phases: GSDPhase[]
  currentPhaseNumber: number | null
  waves: GSDWave[]
}

export interface GSDExecutionResult {
  success: boolean
  output: string
  error?: string
}
