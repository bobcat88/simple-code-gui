#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const criticalFolders = [
  {
    path: 'src/renderer/api/http-backend/',
    thresholds: { statements: 65, branches: 50, functions: 45, lines: 65 },
  },
  {
    path: 'src/renderer/api/httpClient/',
    thresholds: { statements: 55, branches: 50, functions: 30, lines: 55 },
  },
  {
    path: 'src/renderer/components/intelligence/',
    thresholds: { statements: 50, branches: 40, functions: 40, lines: 50 },
  },
  {
    path: 'src/renderer/components/orchestration/',
    thresholds: { statements: 70, branches: 65, functions: 75, lines: 70 },
  },
]

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function resolveBase() {
  if (process.env.GITHUB_BASE_REF) {
    try {
      return `origin/${process.env.GITHUB_BASE_REF}`
    } catch {
      return 'origin/main'
    }
  }
  try {
    return git(['merge-base', 'HEAD', 'origin/main'])
  } catch {
    return 'HEAD~1'
  }
}

function changedFiles(base) {
  const committed = git(['diff', '--name-only', `${base}...HEAD`])
  const workingTree = git(['diff', '--name-only'])
  const staged = git(['diff', '--name-only', '--cached'])
  return [...new Set([committed, workingTree, staged].flatMap((output) => (output ? output.split('\n') : [])))]
}

function aggregateCoverage(summary, folder) {
  const root = `${process.cwd()}${path.sep}`
  const entries = Object.entries(summary).filter(([file]) => {
    if (file === 'total') return false
    const relative = file.startsWith(root) ? file.slice(root.length) : file
    return relative.startsWith(folder)
  })

  const aggregate = {
    statements: { total: 0, covered: 0 },
    branches: { total: 0, covered: 0 },
    functions: { total: 0, covered: 0 },
    lines: { total: 0, covered: 0 },
  }

  for (const [, metrics] of entries) {
    for (const key of Object.keys(aggregate)) {
      aggregate[key].total += metrics[key]?.total ?? 0
      aggregate[key].covered += metrics[key]?.covered ?? 0
    }
  }

  return Object.fromEntries(
    Object.entries(aggregate).map(([key, metric]) => [
      key,
      metric.total === 0 ? 100 : Number(((metric.covered / metric.total) * 100).toFixed(2)),
    ])
  )
}

const summaryPath = 'coverage/coverage-summary.json'
if (!existsSync(summaryPath)) {
  console.error(`Missing ${summaryPath}. Run coverage first.`)
  process.exit(1)
}

const base = resolveBase()
const touched = changedFiles(base)
const touchedFolders = criticalFolders.filter((folder) =>
  touched.some((file) => file.startsWith(folder.path))
)

if (touchedFolders.length === 0) {
  console.log('No touched critical coverage folders.')
  process.exit(0)
}

const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
const failures = []

for (const folder of touchedFolders) {
  const coverage = aggregateCoverage(summary, folder.path)
  for (const [metric, threshold] of Object.entries(folder.thresholds)) {
    if (coverage[metric] < threshold) {
      failures.push(`${folder.path} ${metric}: ${coverage[metric]} < ${threshold}`)
    }
  }
  console.log(`${folder.path}`, coverage)
}

if (failures.length > 0) {
  console.error(`Touched-folder coverage failed:\n${failures.join('\n')}`)
  process.exit(1)
}

console.log('Touched-folder coverage passed.')
