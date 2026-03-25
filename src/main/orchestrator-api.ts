import * as http from 'http'
import type { BrowserWindow } from 'electron'
import type { PtyManager } from './pty-manager.js'
import type { SessionStore } from './session-store.js'

const ORCHESTRATOR_PORT = 19836
const MAX_PORT_RETRIES = 5

export class OrchestratorApi {
  private server: http.Server | null = null
  private ptyManager: PtyManager
  private ptyToProject: Map<string, string>
  private ptyToBackend: Map<string, string>
  private sessionStore: SessionStore
  private getMainWindow: () => BrowserWindow | null
  private activePort: number = ORCHESTRATOR_PORT

  constructor(
    ptyManager: PtyManager,
    ptyToProject: Map<string, string>,
    ptyToBackend: Map<string, string>,
    sessionStore: SessionStore,
    getMainWindow: () => BrowserWindow | null,
  ) {
    this.ptyManager = ptyManager
    this.ptyToProject = ptyToProject
    this.ptyToBackend = ptyToBackend
    this.sessionStore = sessionStore
    this.getMainWindow = getMainWindow
  }

  start(): void {
    if (this.server) return

    this.activePort = ORCHESTRATOR_PORT

    this.server = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json')

      // Only allow localhost
      const remote = req.socket.remoteAddress
      if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') {
        res.writeHead(403)
        res.end(JSON.stringify({ error: 'Forbidden' }))
        return
      }

      const url = new URL(req.url || '/', `http://localhost:${this.activePort}`)
      const path = url.pathname

      // Match: /sessions/:id/output or /sessions/:id/input
      const sessionMatch = path.match(/^\/sessions\/([^/]+)\/(output|input)$/)
      // Match: /sessions/:id (for DELETE)
      const sessionIdMatch = path.match(/^\/sessions\/([^/]+)$/)

      if (req.method === 'GET' && path === '/sessions') {
        this.handleListSessions(res)
      } else if (req.method === 'POST' && path === '/sessions') {
        this.handleCreateSession(req, res)
      } else if (req.method === 'DELETE' && sessionIdMatch) {
        this.handleDeleteSession(sessionIdMatch[1], res)
      } else if (req.method === 'GET' && sessionMatch?.[2] === 'output') {
        const maxLines = parseInt(url.searchParams.get('lines') || '50', 10)
        this.handleReadOutput(sessionMatch[1], maxLines, res)
      } else if (req.method === 'POST' && sessionMatch?.[2] === 'input') {
        this.handleSendInput(sessionMatch[1], req, res)
      } else {
        res.writeHead(404)
        res.end(JSON.stringify({ error: 'Not found' }))
      }
    })

    this.tryListen(this.activePort)
  }

  private tryListen(port: number): void {
    const retryCount = port - ORCHESTRATOR_PORT
    if (retryCount >= MAX_PORT_RETRIES) {
      console.error(`[Orchestrator] Failed to bind after ${MAX_PORT_RETRIES} attempts (ports ${ORCHESTRATOR_PORT}-${port - 1})`)
      this.server?.close()
      this.server = null
      return
    }

    this.server!.listen(port, '127.0.0.1', () => {
      this.activePort = port
      console.log(`[Orchestrator] API server started on port ${port}`)
    })

    this.server!.once('error', (e: NodeJS.ErrnoException) => {
      if (e.code === 'EADDRINUSE') {
        console.warn(`[Orchestrator] Port ${port} in use, trying ${port + 1}`)
        this.tryListen(port + 1)
      } else {
        console.error('[Orchestrator] API server error:', e.message)
        this.server?.close()
        this.server = null
      }
    })
  }

  stop(): void {
    this.server?.close()
    this.server = null
  }

  private handleListSessions(res: http.ServerResponse): void {
    const sessions = this.ptyManager.listSessions()
    // Enrich with project path from ptyToProject map
    const enriched = sessions.map(s => ({
      ...s,
      projectPath: this.ptyToProject.get(s.id) || s.cwd,
      projectName: (this.ptyToProject.get(s.id) || s.cwd).split('/').pop() || 'unknown',
    }))
    res.writeHead(200)
    res.end(JSON.stringify({ sessions: enriched }))
  }

  private handleReadOutput(id: string, maxLines: number, res: http.ServerResponse): void {
    const lines = this.ptyManager.readOutput(id, maxLines)
    if (lines === null) {
      res.writeHead(404)
      res.end(JSON.stringify({ error: 'Session not found' }))
      return
    }
    res.writeHead(200)
    res.end(JSON.stringify({ lines }))
  }

  private handleCreateSession(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > 10240) {
        res.writeHead(413)
        res.end(JSON.stringify({ error: 'Request too large' }))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        const data = JSON.parse(body)
        const cwd = data.cwd
        if (!cwd || typeof cwd !== 'string') {
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'cwd is required' }))
          return
        }

        // Resolve effective backend (same logic as pty:spawn IPC handler)
        const workspace = this.sessionStore.getWorkspace()
        const project = workspace.projects.find((p: any) => p.path === cwd)
        const globalSettings = this.sessionStore.getSettings()

        const normalizedGlobalBackend = globalSettings.backend === 'default'
          ? undefined
          : globalSettings.backend

        const requestedBackend = data.backend === 'default' ? undefined : data.backend
        const effectiveBackend = requestedBackend
          || (project?.backend && project.backend !== 'default'
            ? project.backend
            : normalizedGlobalBackend || 'claude')

        const effectiveModel = data.model || undefined
        const autoAcceptTools = project?.autoAcceptTools ?? globalSettings.autoAcceptTools
        const permissionMode = project?.permissionMode ?? globalSettings.permissionMode

        const id = this.ptyManager.spawn(cwd, undefined, autoAcceptTools, permissionMode, effectiveModel, effectiveBackend)
        this.ptyToProject.set(id, cwd)
        this.ptyToBackend.set(id, effectiveBackend)

        // Wire up onData for output buffer (so read_session_output works)
        this.ptyManager.onData(id, () => {
          // Output is already captured by PtyManager's internal onData handler
          // into the outputBuffer. No additional action needed here.
        })

        // Wire up onExit for cleanup
        this.ptyManager.onExit(id, () => {
          this.ptyToProject.delete(id)
          this.ptyToBackend.delete(id)
        })

        res.writeHead(201)
        res.end(JSON.stringify({ session_id: id, backend: effectiveBackend, cwd }))
      } catch {
        res.writeHead(400)
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
      }
    })
  }

  private handleDeleteSession(id: string, res: http.ServerResponse): void {
    const proc = this.ptyManager.getProcess(id)
    if (!proc) {
      res.writeHead(404)
      res.end(JSON.stringify({ error: 'Session not found' }))
      return
    }

    // Notify renderer to close the tab before killing the PTY
    // (kill() disposes the onExit listener, so the normal pty:exit event won't fire)
    const mainWindow = this.getMainWindow()
    mainWindow?.webContents.send(`pty:exit:${id}`, 0)

    this.ptyToProject.delete(id)
    this.ptyToBackend.delete(id)
    this.ptyManager.kill(id)

    res.writeHead(200)
    res.end(JSON.stringify({ success: true, message: `Session ${id} closed` }))
  }

  private handleSendInput(id: string, req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > 10240) {
        res.writeHead(413)
        res.end(JSON.stringify({ error: 'Input too large' }))
        req.destroy()
      }
    })
    req.on('end', async () => {
      try {
        const data = JSON.parse(body)
        const input = data.input || data.text || data.message || ''
        if (!input) {
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'No input provided' }))
          return
        }

        const proc = this.ptyManager.getProcess(id)
        if (!proc) {
          res.writeHead(404)
          res.end(JSON.stringify({ error: 'Session not found' }))
          return
        }

        // In raw mode, send input as-is (for permission prompts, single keypresses)
        // Otherwise write input first, then send Enter after a short delay.
        // This mimics how a user pastes text then presses Enter — TUI apps like
        // Claude Code need a moment to process multi-line pastes before the
        // trailing \r is recognized as a submit action.
        const raw = data.raw === true
        if (raw) {
          this.ptyManager.write(id, input)
        } else {
          this.ptyManager.write(id, input)
          await new Promise(resolve => setTimeout(resolve, 150))
          this.ptyManager.write(id, '\r')
        }
        res.writeHead(200)
        res.end(JSON.stringify({ success: true, message: `Input sent to session ${id}` }))
      } catch {
        res.writeHead(400)
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
      }
    })
  }
}

export { ORCHESTRATOR_PORT }
