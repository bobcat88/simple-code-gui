// TADA TTS engine - manages a persistent Python subprocess for speech synthesis
// Uses HumeAI/tada-1b model with voice cloning from audio samples

import { spawn, ChildProcess } from 'child_process'
import { existsSync, writeFileSync, mkdirSync } from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import { logTTS } from './debug.js'
import { TADA_SERVER_SCRIPT } from './tada-server-script.js'

const execAsync = promisify(exec)

// Path to the TADA venv
const TADA_VENV_DIR = '/tmp/tada-env'
const TADA_PYTHON = path.join(TADA_VENV_DIR, 'bin', 'python')

// Bundled voice samples
export interface TadaSampleVoice {
  id: string
  name: string
  filename: string
  description: string
  license: string
}

export const TADA_SAMPLE_VOICES: TadaSampleVoice[] = [
  { id: 'cute-voice-1', name: 'Cute Voice 1', filename: 'cute-voice-1.wav', description: 'Bright, expressive female voice (14s)', license: 'CC' },
  { id: 'cute-voice-2', name: 'Cute Voice 2', filename: 'cute-voice-2.wav', description: 'Warm, cheerful female voice (30s)', license: 'CC' },
  { id: 'cute-voice-3', name: 'Cute Voice 3', filename: 'cute-voice-3.wav', description: 'Soft, kawaii female voice (18s)', license: 'CC' }
]

export function getTadaSamplePath(sampleId: string): string | null {
  const sample = TADA_SAMPLE_VOICES.find(s => s.id === sampleId)
  if (!sample) return null

  // In development: resources/tada-samples/
  const devPath = path.join(app.getAppPath(), 'resources', 'tada-samples', sample.filename)
  if (existsSync(devPath)) return devPath

  // In production: extraResources/tada-samples/
  const prodPath = path.join(process.resourcesPath, 'tada-samples', sample.filename)
  if (existsSync(prodPath)) return prodPath

  return null
}

function ensureServerScript(): string {
  const tadaDir = path.join(app.getPath('userData'), 'deps', 'tada')
  const scriptPath = path.join(tadaDir, 'tada-server.py')
  if (!existsSync(tadaDir)) {
    mkdirSync(tadaDir, { recursive: true })
  }
  writeFileSync(scriptPath, TADA_SERVER_SCRIPT)
  return scriptPath
}

interface TadaResponse {
  ready?: boolean
  device?: string
  success?: boolean
  cached?: boolean
  error?: string
  audioData?: string
  duration?: number
  elapsed?: number
  loaded?: boolean
  voice_sample?: string | null
  gpu_free_mb?: number | null
  bye?: boolean
}

type PendingRequest = {
  resolve: (value: TadaResponse) => void
  reject: (error: Error) => void
}

class TadaTTS {
  private process: ChildProcess | null = null
  private ready = false
  private pendingRequests: PendingRequest[] = []
  private buffer = ''
  private currentVoiceSample: string | null = null
  private starting = false

  async install(): Promise<{ success: boolean; error?: string }> {
    try {
      // Find a suitable Python
      let pythonCmd = 'python3'
      try {
        await execAsync('python3 --version', { timeout: 5000 })
      } catch {
        try {
          await execAsync('python --version', { timeout: 5000 })
          pythonCmd = 'python'
        } catch {
          return { success: false, error: 'Python 3 not found. Please install Python 3.10+ first.' }
        }
      }

      // Verify Python version (need 3.10+)
      try {
        const { stdout } = await execAsync(`${pythonCmd} -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')"`, { timeout: 5000 })
        const [major, minor] = stdout.trim().split('.').map(Number)
        if (major < 3 || (major === 3 && minor < 10)) {
          return { success: false, error: `Python 3.10+ required, found ${stdout.trim()}` }
        }
      } catch {
        return { success: false, error: 'Could not determine Python version' }
      }

      // Create venv
      if (!existsSync(TADA_PYTHON)) {
        logTTS('Creating TADA venv', { dir: TADA_VENV_DIR })
        await execAsync(`${pythonCmd} -m venv "${TADA_VENV_DIR}"`, { timeout: 120000 })
      }

      if (!existsSync(TADA_PYTHON)) {
        return { success: false, error: 'Failed to create virtual environment' }
      }

      // Upgrade pip
      await execAsync(`"${TADA_PYTHON}" -m pip install --upgrade pip`, { timeout: 120000 })

      // Install tada and dependencies
      logTTS('Installing TADA dependencies')
      await execAsync(`"${TADA_PYTHON}" -m pip install tada huggingface_hub`, { timeout: 900000 })

      // Verify installation
      const status = await this.checkInstallation()
      if (!status.venvExists) {
        return { success: false, error: 'Installation verification failed' }
      }

      logTTS('TADA installation complete')
      return { success: true }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      return { success: false, error }
    }
  }

  async checkInstallation(): Promise<{
    installed: boolean
    pythonPath: string | null
    venvExists: boolean
    hfAuthenticated?: boolean
    error?: string
  }> {
    const venvExists = existsSync(TADA_PYTHON)

    if (!venvExists) {
      return {
        installed: false,
        pythonPath: null,
        venvExists: false,
        error: 'TADA venv not found. Please install TADA dependencies first.'
      }
    }

    // Check if tada module is importable
    try {
      await execAsync(`"${TADA_PYTHON}" -c "import tada; print('ok')"`, { timeout: 15000 })
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      return {
        installed: false,
        pythonPath: TADA_PYTHON,
        venvExists: true,
        error: `TADA module not found: ${error}`
      }
    }

    // Check HuggingFace authentication (needed for gated Llama 3.2 tokenizer)
    const hfAuthenticated = await this.checkHfAuth()
    if (!hfAuthenticated) {
      return {
        installed: true,
        pythonPath: TADA_PYTHON,
        venvExists: true,
        hfAuthenticated: false,
        error: 'HuggingFace login required. TADA uses a gated Llama 3.2 tokenizer — you need to accept access at https://huggingface.co/meta-llama/Llama-3.2-1B and log in with: huggingface-cli login'
      }
    }

    return { installed: true, pythonPath: TADA_PYTHON, venvExists: true, hfAuthenticated: true }
  }

  private async checkHfAuth(): Promise<boolean> {
    // Check if HF token exists
    const tokenPath = path.join(process.env.HOME || '', '.cache', 'huggingface', 'token')
    if (!existsSync(tokenPath)) return false

    // Verify token is valid by checking with huggingface_hub
    try {
      await execAsync(
        `"${TADA_PYTHON}" -c "from huggingface_hub import HfApi; HfApi().whoami(); print('ok')"`,
        { timeout: 10000 }
      )
      return true
    } catch {
      return false
    }
  }

  async loginHuggingFace(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      await execAsync(
        `"${TADA_PYTHON}" -c "from huggingface_hub import login; login(token='${token.replace(/'/g, '')}', add_to_git_credential=True)"`,
        { timeout: 15000 }
      )
      return { success: true }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      return { success: false, error }
    }
  }

  private async ensureProcess(): Promise<void> {
    if (this.process && this.ready) return

    if (this.starting) {
      // Wait for existing startup
      return new Promise((resolve, reject) => {
        const check = setInterval(() => {
          if (this.ready) {
            clearInterval(check)
            resolve()
          }
          if (!this.starting && !this.ready) {
            clearInterval(check)
            reject(new Error('TADA process failed to start'))
          }
        }, 100)
        // Timeout after 120s (model loading can be slow)
        setTimeout(() => {
          clearInterval(check)
          if (!this.ready) reject(new Error('TADA startup timeout'))
        }, 120000)
      })
    }

    this.starting = true
    this.ready = false

    const scriptPath = ensureServerScript()
    logTTS('Starting TADA server', { python: TADA_PYTHON, script: scriptPath })

    return new Promise((resolve, reject) => {
      this.process = spawn(TADA_PYTHON, [scriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env
      })

      this.buffer = ''

      this.process.stdout!.on('data', (data: Buffer) => {
        this.buffer += data.toString()
        const lines = this.buffer.split('\n')
        this.buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const response: TadaResponse = JSON.parse(line)

            if (response.ready !== undefined) {
              if (response.ready) {
                logTTS('TADA server ready', { device: response.device })
                this.ready = true
                this.starting = false
                resolve()
              } else {
                const err = new Error(response.error || 'TADA failed to initialize')
                this.starting = false
                reject(err)
              }
              continue
            }

            // Route to pending request
            const pending = this.pendingRequests.shift()
            if (pending) {
              pending.resolve(response)
            }
          } catch (e) {
            logTTS('TADA: Failed to parse response', { line })
          }
        }
      })

      this.process.stderr!.on('data', (data: Buffer) => {
        const msg = data.toString().trim()
        if (msg) logTTS(`TADA stderr: ${msg}`)
      })

      this.process.on('exit', (code) => {
        logTTS(`TADA process exited with code ${code}`)
        this.process = null
        this.ready = false
        this.starting = false

        // Reject all pending requests
        while (this.pendingRequests.length > 0) {
          const pending = this.pendingRequests.shift()!
          pending.reject(new Error(`TADA process exited with code ${code}`))
        }
      })

      this.process.on('error', (err) => {
        logTTS(`TADA process error: ${err.message}`)
        this.starting = false
        reject(err)
      })
    })
  }

  private async sendCommand(cmd: Record<string, unknown>): Promise<TadaResponse> {
    await this.ensureProcess()

    if (!this.process || !this.process.stdin) {
      throw new Error('TADA process not available')
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.push({ resolve, reject })
      this.process!.stdin!.write(JSON.stringify(cmd) + '\n')
    })
  }

  async loadVoice(voiceSamplePath: string): Promise<{ success: boolean; error?: string }> {
    if (!existsSync(voiceSamplePath)) {
      return { success: false, error: `Voice sample not found: ${voiceSamplePath}` }
    }

    try {
      const result = await this.sendCommand({
        cmd: 'load',
        voice_sample: voiceSamplePath
      })

      if (result.error) {
        return { success: false, error: result.error }
      }

      this.currentVoiceSample = voiceSamplePath
      logTTS('TADA voice loaded', { path: voiceSamplePath, cached: result.cached })
      return { success: true }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      return { success: false, error }
    }
  }

  async speak(
    text: string,
    voiceSamplePath?: string
  ): Promise<{ success: boolean; audioData?: string; error?: string }> {
    try {
      // Load voice if needed
      const samplePath = voiceSamplePath || this.currentVoiceSample
      if (!samplePath) {
        return { success: false, error: 'No voice sample selected' }
      }

      if (samplePath !== this.currentVoiceSample) {
        const loadResult = await this.loadVoice(samplePath)
        if (!loadResult.success) {
          return { success: false, error: loadResult.error }
        }
      }

      // Generate speech
      const result = await this.sendCommand({ cmd: 'speak', text })

      if (result.error) {
        return { success: false, error: result.error }
      }

      logTTS('TADA generated speech', {
        textLength: text.length,
        duration: result.duration,
        elapsed: result.elapsed
      })

      return { success: true, audioData: result.audioData }
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      return { success: false, error }
    }
  }

  async getStatus(): Promise<TadaResponse> {
    if (!this.process || !this.ready) {
      return { loaded: false, voice_sample: null }
    }

    try {
      return await this.sendCommand({ cmd: 'status' })
    } catch {
      return { loaded: false, voice_sample: null }
    }
  }

  getCurrentVoiceSample(): string | null {
    return this.currentVoiceSample
  }

  stopSpeaking(): void {
    // TADA generates in one shot, no streaming to stop
    // But we can kill the process if needed
  }

  shutdown(): void {
    if (this.process) {
      try {
        this.process.stdin?.write(JSON.stringify({ cmd: 'quit' }) + '\n')
      } catch {
        // Process might already be dead
      }
      setTimeout(() => {
        if (this.process) {
          this.process.kill()
          this.process = null
        }
      }, 2000)
      this.ready = false
    }
  }
}

export const tadaTTS = new TadaTTS()
