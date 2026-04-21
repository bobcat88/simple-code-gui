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

export interface BackgroundJob {
  id: string;
  job_type: string;
  payload: string;
  status: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Cancelled';
  progress: number;
  result?: string;
  error?: string;
}

interface JobState {
  status: DispatchStatus | null; // Kspec dispatch status
  jobs: BackgroundJob[];         // Generic background jobs
  lastUpdate: number;
  isPolling: boolean;
  
  setStatus: (status: DispatchStatus) => void;
  setJobs: (jobs: BackgroundJob[]) => void;
  setPolling: (isPolling: boolean) => void;
}

export const useJobStore = create<JobState>((set) => ({
  status: null,
  jobs: [],
  lastUpdate: 0,
  isPolling: false,
  
  setStatus: (status) => set({ status, lastUpdate: Date.now() }),
  setJobs: (jobs) => set({ jobs, lastUpdate: Date.now() }),
  setPolling: (isPolling) => set({ isPolling })
}))
