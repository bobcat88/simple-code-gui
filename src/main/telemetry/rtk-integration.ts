/**
 * RTK integration — fetches token savings data from rtk gain.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import type { RtkSavings } from './telemetry-store'

const execFileAsync = promisify(execFile)

export async function fetchRtkSavings(): Promise<RtkSavings | null> {
  try {
    // Check if rtk is available
    const { stdout } = await execFileAsync('rtk', ['gain', '--json'], {
      timeout: 5000,
      env: { ...process.env },
    })

    const data = JSON.parse(stdout)
    return {
      totalSaved: data.total_saved ?? data.totalSaved ?? 0,
      percentSaved: data.percent_saved ?? data.percentSaved ?? 0,
      commandCount: data.command_count ?? data.commandCount ?? 0,
      lastUpdated: Date.now(),
    }
  } catch {
    // RTK not installed or command failed — not an error
    return null
  }
}

/**
 * Check if RTK is installed and available.
 */
export async function isRtkAvailable(): Promise<boolean> {
  try {
    await execFileAsync('rtk', ['--version'], { timeout: 3000 })
    return true
  } catch {
    return false
  }
}
