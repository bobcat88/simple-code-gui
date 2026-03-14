/**
 * Kspec Proxy Routes
 *
 * Proxies requests from the mobile app to the kspec daemon running on localhost:3456.
 * The mobile app can't reach localhost:3456 directly since that's the desktop machine.
 * Also handles filesystem checks and daemon startup since mobile can't use IPC.
 */

import { Router, Request, Response } from 'express'
import { existsSync } from 'fs'
import { join } from 'path'
import { spawn } from 'child_process'
import { sendResponse, sendError } from './helpers.js'

const DAEMON_PORT = 3456
const DAEMON_BASE = `http://localhost:${DAEMON_PORT}`

const router = Router()

/** Ensure the kspec daemon is running, starting it if needed */
async function ensureDaemon(cwd: string): Promise<boolean> {
  // Check if daemon is already running
  try {
    const res = await fetch(`${DAEMON_BASE}/api/health`)
    if (res.ok) {
      // Register this project with the running daemon
      await fetch(`${DAEMON_BASE}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: cwd })
      }).catch(() => {})
      return true
    }
  } catch { /* daemon not running */ }

  // Try to start daemon
  try {
    const proc = spawn('kspec', ['serve', 'start', '--daemon'], {
      cwd,
      detached: true,
      stdio: 'ignore'
    })
    proc.unref()

    // Wait for daemon to be ready (up to 5 seconds)
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 500))
      try {
        const res = await fetch(`${DAEMON_BASE}/api/health`)
        if (res.ok) return true
      } catch { /* not ready yet */ }
    }
  } catch { /* spawn failed */ }

  return false
}

/**
 * GET /api/projects/kspec/check
 * Check if kspec is initialized for a project
 *
 * Query: cwd (required) - project path
 */
router.get('/check', async (req: Request, res: Response) => {
  try {
    const cwd = req.query.cwd as string
    if (!cwd) return sendError(res, 400, 'cwd query parameter is required')

    // Check filesystem for .kspec/ directory
    const kspecPath = join(cwd, '.kspec')
    const exists = existsSync(kspecPath)

    if (exists) {
      // Try to ensure daemon is running
      await ensureDaemon(cwd)
    }

    sendResponse(res, 200, { success: true, data: { exists }, timestamp: Date.now() })
  } catch (error: any) {
    sendError(res, 500, error.message || 'Failed to check kspec')
  }
})

/**
 * Proxy all other kspec API calls to the daemon
 */
async function proxyToDaemon(req: Request, res: Response, path: string, method: string, cwd: string, body?: unknown) {
  try {
    // Ensure daemon is running before proxying
    const running = await ensureDaemon(cwd)
    if (!running) {
      return sendError(res, 502, 'Kspec daemon not running and could not be started')
    }

    const opts: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Kspec-Dir': cwd
      }
    }
    if (body && method !== 'GET' && method !== 'DELETE') {
      opts.body = JSON.stringify(body)
    }

    const daemonRes = await fetch(`${DAEMON_BASE}${path}`, opts)
    const data = await daemonRes.json().catch(() => ({}))

    res.status(daemonRes.status).json(data)
  } catch (error: any) {
    sendError(res, 502, `Kspec daemon unreachable: ${error.message || 'connection refused'}`)
  }
}

// GET /api/projects/kspec/tasks - list tasks
router.get('/tasks', (req: Request, res: Response) => {
  const cwd = req.query.cwd as string
  if (!cwd) return sendError(res, 400, 'cwd query parameter is required')
  proxyToDaemon(req, res, '/api/tasks', 'GET', cwd)
})

// GET /api/projects/kspec/tasks/:taskId - get task detail
router.get('/tasks/:taskId', (req: Request, res: Response) => {
  const cwd = req.query.cwd as string
  if (!cwd) return sendError(res, 400, 'cwd query parameter is required')
  proxyToDaemon(req, res, `/api/tasks/${encodeURIComponent(req.params.taskId)}`, 'GET', cwd)
})

// POST /api/projects/kspec/tasks - create task
router.post('/tasks', (req: Request, res: Response) => {
  const { cwd, ...body } = req.body
  if (!cwd) return sendError(res, 400, 'cwd is required')
  proxyToDaemon(req, res, '/api/tasks', 'POST', cwd, body)
})

// PATCH /api/projects/kspec/tasks/:taskId - update task
router.patch('/tasks/:taskId', (req: Request, res: Response) => {
  const { cwd, ...body } = req.body
  if (!cwd) return sendError(res, 400, 'cwd is required')
  proxyToDaemon(req, res, `/api/tasks/${encodeURIComponent(req.params.taskId)}`, 'PATCH', cwd, body)
})

// POST /api/projects/kspec/tasks/:taskId/start
router.post('/tasks/:taskId/start', (req: Request, res: Response) => {
  const { cwd } = req.body
  if (!cwd) return sendError(res, 400, 'cwd is required')
  proxyToDaemon(req, res, `/api/tasks/${encodeURIComponent(req.params.taskId)}/start`, 'POST', cwd)
})

// POST /api/projects/kspec/tasks/:taskId/complete
router.post('/tasks/:taskId/complete', (req: Request, res: Response) => {
  const { cwd } = req.body
  if (!cwd) return sendError(res, 400, 'cwd is required')
  proxyToDaemon(req, res, `/api/tasks/${encodeURIComponent(req.params.taskId)}/complete`, 'POST', cwd)
})

// DELETE /api/projects/kspec/tasks/:taskId
router.delete('/tasks/:taskId', (req: Request, res: Response) => {
  const cwd = req.query.cwd as string
  if (!cwd) return sendError(res, 400, 'cwd query parameter is required')
  proxyToDaemon(req, res, `/api/tasks/${encodeURIComponent(req.params.taskId)}`, 'DELETE', cwd)
})

export default router
