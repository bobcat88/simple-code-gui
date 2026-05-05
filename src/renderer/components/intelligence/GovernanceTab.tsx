import React, { useState, useEffect } from 'react'
import { 
  ShieldCheck, 
  Users, 
  RefreshCw, 
  Settings, 
  Lock, 
  Globe, 
  Database,
  CloudLightning,
  AlertCircle,
  CheckCircle2
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ExtendedApi } from '../../api/types'

interface GovernanceTabProps {
  api: ExtendedApi
  projectPath?: string | null
}

export function GovernanceTab({ api, projectPath }: GovernanceTabProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'success'>('idle')
  const [autoSync, setAutoSync] = useState(false)
  
  useEffect(() => {
    // Check if auto sync is already running
    const checkSyncStatus = async () => {
      try {
        const running = await api.gsdGetSyncStatus?.();
        setAutoSync(running ?? false);
      } catch (err) {
        console.error('Failed to get sync status:', err)
      }
    }
    
    checkSyncStatus();
    const interval = setInterval(checkSyncStatus, 5000);
    return () => clearInterval(interval);
  }, [api])

  const handleManualSync = async () => {
    setSyncStatus('syncing')
    try {
      const imported = await api.gsdSyncMemory?.()
      setSyncStatus('success')
      setLastSync(new Date().toLocaleTimeString())
      setTimeout(() => setSyncStatus('idle'), 3000)
    } catch (err) {
      console.error('Manual sync failed:', err)
      setSyncStatus('error')
    }
  }

  const toggleAutoSync = async () => {
    try {
      if (autoSync) {
        await api.gsdStopAutomaticSync?.()
        setAutoSync(false)
      } else {
        await api.gsdStartAutomaticSync?.()
        setAutoSync(true)
      }
    } catch (err) {
      console.error('Failed to toggle auto sync:', err)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex-1 overflow-y-auto space-y-6 p-4">
        {/* Sync Controls */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white/80 flex items-center gap-2">
              <CloudLightning className="w-4 h-4 text-cyan-400" />
              Quantum Bridge
            </h3>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold",
                syncStatus === 'syncing' ? "bg-cyan-500/20 text-cyan-400 animate-pulse" :
                syncStatus === 'success' ? "bg-emerald-500/20 text-emerald-400" :
                syncStatus === 'error' ? "bg-red-500/20 text-red-400" :
                "bg-white/5 text-white/40"
              )}>
                {syncStatus === 'syncing' ? 'Syncing' : 
                 syncStatus === 'success' ? 'Synced' :
                 syncStatus === 'error' ? 'Error' : 'Idle'}
              </span>
            </div>
          </div>

          <div className="glass-panel p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-white/60">Real-time Memory Sync</p>
                <p className="text-[10px] text-white/30">Sync learnings with Borg Collective</p>
              </div>
              <button 
                onClick={toggleAutoSync}
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
                  autoSync ? "bg-cyan-500" : "bg-white/10"
                )}
              >
                <span className={cn(
                  "inline-block h-3 w-3 transform rounded-full bg-white transition-transform",
                  autoSync ? "translate-x-5" : "translate-x-1"
                )} />
              </button>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <div className="text-[10px] text-white/30">
                {lastSync ? `Last synced: ${lastSync}` : 'No sync in this session'}
              </div>
              <button 
                onClick={handleManualSync}
                disabled={syncStatus === 'syncing'}
                className="flex items-center gap-1.5 text-[10px] font-medium text-cyan-400 hover:text-cyan-300 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={cn("w-3 h-3", syncStatus === 'syncing' && "animate-spin")} />
                Sync Now
              </button>
            </div>
          </div>
        </section>

        {/* Governance Policy */}
        <section className="space-y-4">
          <h3 className="text-sm font-medium text-white/80 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Swarm Governance
          </h3>
          
          <div className="space-y-2">
            <div className="glass-panel p-3 flex items-center gap-3 group hover:bg-white/5 transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-white/80">Persona Configuration</p>
                <p className="text-[10px] text-white/40">Manage agent identities & roles</p>
              </div>
              <Settings className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40" />
            </div>

            <div className="glass-panel p-3 flex items-center gap-3 group hover:bg-white/5 transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <Lock className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-white/80">Access Control Policies</p>
                <p className="text-[10px] text-white/40">Define what swarms can modify</p>
              </div>
              <Settings className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40" />
            </div>

            <div className="glass-panel p-3 flex items-center gap-3 group hover:bg-white/5 transition-colors cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Globe className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-white/80">Global Knowledge Policy</p>
                <p className="text-[10px] text-white/40">Whitelisting for Borg assimilation</p>
              </div>
              <Settings className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40" />
            </div>
          </div>
        </section>

        {/* Snapshot History */}
        <section className="space-y-4">
          <h3 className="text-sm font-medium text-white/80 flex items-center gap-2">
            <Database className="w-4 h-4 text-orange-400" />
            Cognitive Snapshots
          </h3>
          <div className="glass-panel p-4 flex flex-col items-center justify-center py-8 text-center space-y-2">
            <p className="text-xs text-white/40">Snapshotting is active for this project.</p>
            <p className="text-[10px] text-white/20">All session thought-chains are Git-backed.</p>
            <button className="mt-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] text-white/60 transition-colors border border-white/5">
              View Snapshot History
            </button>
          </div>
        </section>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-white/5 bg-black/20">
        <div className="flex items-center gap-2 text-[10px] text-white/30">
          <AlertCircle className="w-3 h-3" />
          <span>Governance is enforced by the GSD Runtime.</span>
        </div>
      </div>
    </div>
  )
}
