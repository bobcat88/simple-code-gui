/**
 * Host storage utilities using localStorage (standard web API)
 */

import type { SavedHost } from './types.js'

const HOSTS_STORAGE_KEY = 'simple-code-gui-saved-hosts'

export async function loadSavedHostsAsync(): Promise<SavedHost[]> {
  try {
    const value = localStorage.getItem(HOSTS_STORAGE_KEY)
    console.log('[ConnectionScreen] Loading saved hosts from localStorage:', value)
    if (!value) return []
    const hosts = JSON.parse(value) as SavedHost[]
    console.log('[ConnectionScreen] Parsed saved hosts:', hosts.length, 'hosts')
    return hosts
  } catch (e) {
    console.error('[ConnectionScreen] Error loading saved hosts:', e)
    return []
  }
}

export async function saveSavedHostsAsync(hosts: SavedHost[]): Promise<void> {
  try {
    console.log('[ConnectionScreen] Saving', hosts.length, 'hosts to localStorage')
    localStorage.setItem(HOSTS_STORAGE_KEY, JSON.stringify(hosts))
    console.log('[ConnectionScreen] Saved successfully')
  } catch (e) {
    console.error('[ConnectionScreen] Error saving hosts:', e)
  }
}

export function generateHostId(): string {
  return `host-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
