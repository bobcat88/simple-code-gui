import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

export interface ProjectIntelligence {
  repoHealth: number
  stacks: string[]
  gitNexusContext?: string
}

export async function getProjectIntelligence(projectPath: string): Promise<ProjectIntelligence> {
  const stacks: string[] = []
  
  // Basic stack detection
  if (existsSync(join(projectPath, 'package.json'))) {
    stacks.push('Node.js')
    try {
      const content = readFileSync(join(projectPath, 'package.json'), 'utf-8')
      const pkg = JSON.parse(content)
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      
      if (deps.react) stacks.push('React')
      if (deps.typescript) stacks.push('TypeScript')
      if (deps.electron) stacks.push('Electron')
      if (deps.next) stacks.push('Next.js')
      if (deps.vite) stacks.push('Vite')
      if (deps.vue) stacks.push('Vue')
      if (deps.svelte) stacks.push('Svelte')
      if (deps.tailwindcss) stacks.push('TailwindCSS')
    } catch (e) {
      console.error('Failed to parse package.json for intelligence:', e)
    }
  }

  if (existsSync(join(projectPath, 'Cargo.toml'))) stacks.push('Rust')
  if (existsSync(join(projectPath, 'pyproject.toml')) || existsSync(join(projectPath, 'requirements.txt'))) stacks.push('Python')
  if (existsSync(join(projectPath, 'go.mod'))) stacks.push('Go')
  if (existsSync(join(projectPath, 'composer.json'))) stacks.push('PHP')
  if (existsSync(join(projectPath, 'gemfile'))) stacks.push('Ruby')
  if (existsSync(join(projectPath, 'package.json')) && existsSync(join(projectPath, 'node_modules'))) stacks.push('npm')
  
  // Repo health (placeholder calculation)
  let health = 100
  if (!existsSync(join(projectPath, '.git'))) health -= 20
  if (!existsSync(join(projectPath, 'README.md'))) health -= 10
  if (!existsSync(join(projectPath, 'package-lock.json')) && existsSync(join(projectPath, 'package.json'))) health -= 5
  
  // Check for specialized tools
  if (existsSync(join(projectPath, '.kspec'))) stacks.push('KSpec')
  if (existsSync(join(projectPath, '.beads'))) stacks.push('Beads')
  if (existsSync(join(projectPath, '.gitnexus'))) stacks.push('GitNexus')

  // Deduplicate and sort
  const uniqueStacks = Array.from(new Set(stacks)).sort()

  return {
    repoHealth: Math.max(0, health),
    stacks: uniqueStacks,
    gitNexusContext: existsSync(join(projectPath, '.gitnexus')) ? 'Indexed by GitNexus' : undefined
  }
}
