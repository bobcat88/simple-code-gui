import React, { useState } from 'react'
import { Plus, Trash2, X, Check, Save } from 'lucide-react'
import { InstalledExtension } from '../hooks/useExtensions'
import { cn } from '../lib/utils'

interface McpConfigEditorProps {
  mcp: InstalledExtension
  onSave: (config: any) => void
  onCancel: () => void
}

export function McpConfigEditor({ mcp, onSave, onCancel }: McpConfigEditorProps) {
  const initialConfig = mcp.config || {}
  const [args, setArgs] = useState<string[]>(Array.isArray(initialConfig.args) ? initialConfig.args : [])
  const [env, setEnv] = useState<Array<{ key: string; value: string }>>(
    Object.entries(initialConfig.env || {}).map(([key, value]) => ({ key, value: String(value) }))
  )

  const handleAddArg = () => setArgs([...args, ''])
  const handleUpdateArg = (index: number, value: string) => {
    const newArgs = [...args]
    newArgs[index] = value
    setArgs(newArgs)
  }
  const handleRemoveArg = (index: number) => setArgs(args.filter((_, i) => i !== index))

  const handleAddEnv = () => setEnv([...env, { key: '', value: '' }])
  const handleUpdateEnv = (index: number, field: 'key' | 'value', value: string) => {
    const newEnv = [...env]
    newEnv[index][field] = value
    setEnv(newEnv)
  }
  const handleRemoveEnv = (index: number) => setEnv(env.filter((_, i) => i !== index))

  const handleSave = () => {
    const finalEnv: Record<string, string> = {}
    env.forEach(item => {
      if (item.key.trim()) finalEnv[item.key.trim()] = item.value
    })
    
    onSave({
      ...initialConfig,
      args: args.filter(a => a.trim() !== ''),
      env: finalEnv
    })
  }

  return (
    <div className="p-4 bg-black/40 rounded-xl border border-white/10 space-y-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Settings2 size={14} className="text-primary" />
          Configure {mcp.name}
        </h4>
        <button onClick={onCancel} className="p-1 hover:bg-white/10 rounded transition-colors">
          <X size={14} className="text-white/40" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Arguments */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase text-white/40 tracking-wider">Arguments</label>
            <button 
              onClick={handleAddArg}
              className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 font-medium px-1.5 py-0.5 rounded hover:bg-primary/5"
            >
              <Plus size={10} /> Add Arg
            </button>
          </div>
          <div className="space-y-1.5">
            {args.map((arg, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={arg}
                  onChange={(e) => handleUpdateArg(idx, e.target.value)}
                  placeholder="--arg value"
                  className="flex-1 bg-white/5 border border-white/5 rounded px-2 py-1.5 text-xs focus:border-primary/50 outline-none transition-colors"
                />
                <button 
                  onClick={() => handleRemoveArg(idx)}
                  className="p-1.5 hover:bg-red-500/10 text-white/20 hover:text-red-400 rounded transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {args.length === 0 && (
              <p className="text-[10px] text-white/20 italic">No custom arguments</p>
            )}
          </div>
        </div>

        {/* Environment Variables */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase text-white/40 tracking-wider">Environment Variables</label>
            <button 
              onClick={handleAddEnv}
              className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 font-medium px-1.5 py-0.5 rounded hover:bg-primary/5"
            >
              <Plus size={10} /> Add Env
            </button>
          </div>
          <div className="space-y-1.5">
            {env.map((item, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={item.key}
                  onChange={(e) => handleUpdateEnv(idx, 'key', e.target.value)}
                  placeholder="KEY"
                  className="w-1/3 bg-white/5 border border-white/5 rounded px-2 py-1.5 text-xs font-mono focus:border-primary/50 outline-none transition-colors"
                />
                <input
                  type="text"
                  value={item.value}
                  onChange={(e) => handleUpdateEnv(idx, 'value', e.target.value)}
                  placeholder="value"
                  className="flex-1 bg-white/5 border border-white/5 rounded px-2 py-1.5 text-xs focus:border-primary/50 outline-none transition-colors"
                />
                <button 
                  onClick={() => handleRemoveEnv(idx)}
                  className="p-1.5 hover:bg-red-500/10 text-white/20 hover:text-red-400 rounded transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {env.length === 0 && (
              <p className="text-[10px] text-white/20 italic">No custom env vars</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button 
          onClick={onCancel}
          className="px-3 py-1.5 rounded-md text-xs font-medium text-white/40 hover:bg-white/5 transition-colors"
        >
          Cancel
        </button>
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/20"
        >
          <Save size={12} />
          Save Config
        </button>
      </div>
    </div>
  )
}

import { Settings2 } from 'lucide-react'
