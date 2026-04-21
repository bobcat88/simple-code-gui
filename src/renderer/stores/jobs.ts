import { create } from 'zustand'

export interface JobInvocation {
  id: string
  task: string
  status: 'running' | 'queued' | 'completed' | 'failed'
  agent: string
  startTime?: string
}

export interface DispatchStatus {
  running: boolean
  activeInvocations: number
  queuedInvocations: number
  invocations: JobInvocation[]
  queued: any[]
  agents: Array<{ id: string; name: string }>
}

interface JobState {
  status: DispatchStatus | null
  lastUpdate: number
  isPolling: boolean
  
  setStatus: (status: DispatchStatus) => void
  setPolling: (isPolling: boolean) => void
}

export const useJobStore = create<JobState>((set) => ({
  status: null,
  lastUpdate: 0,
  isPolling: false,
  
  setStatus: (status) => set({ status, lastUpdate: Date.now() }),
  setPolling: (isPolling) => set({ isPolling })
}))
