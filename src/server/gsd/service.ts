import { GsdEngine } from './engine'

const engines = new Map<string, GsdEngine>()

export function getGsdEngine(cwd: string): GsdEngine {
  if (!engines.has(cwd)) {
    // Basic extraction of project name from path
    const projectName = cwd.split('/').pop() || 'Untitled'
    engines.set(cwd, new GsdEngine(cwd, projectName))
  }
  return engines.get(cwd)!
}

/**
 * GSD Project Check Service
 * Checks if a project is initialized for GSD.
 */
export async function gsdProjectCheck(cwd: string): Promise<any> {
  const engine = getGsdEngine(cwd)
  await engine.initialize()
  return { initialized: true }
}

/**
 * GSD Get Progress Service
 * Returns the current progress of the GSD pipeline.
 */
export async function gsdGetProgress(cwd: string): Promise<any> {
  try {
    const engine = getGsdEngine(cwd)
    // Ensure initialized
    await engine.initialize()
    const progress = engine.getProgress()
    
    return {
      success: true,
      data: progress
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to get GSD progress'
    }
  }
}
