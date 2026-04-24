import React, { useState } from 'react'
import { 
  Sparkles, 
  Cpu, 
  Zap, 
  ShieldCheck, 
  ChevronRight, 
  Key, 
  Globe, 
  Plus,
  Settings2,
  Table,
  Layout
} from 'lucide-react'
import type { AiRuntimeSettings as AiRuntimeSettingsType, ProviderConfig, ModelPlan, AgentRoutingPolicy } from './settingsTypes'
import { cn } from '../../lib/utils'
import { tauriIpc } from '../../lib/tauri-ipc'
import { useEffect } from 'react'

interface AiRuntimeSettingsProps {
  settings: AiRuntimeSettingsType
  onChange: (settings: AiRuntimeSettingsType) => void
}

export function AiRuntimeSettings({ settings, onChange }: AiRuntimeSettingsProps): React.ReactElement {
  const [activeSubTab, setActiveSubTab] = useState<'plans' | 'providers' | 'routing'>('plans')
  const [editingPlan, setEditingPlan] = useState<ModelPlan | null>(null)
  const [isNewPlan, setIsNewPlan] = useState(false)
  const [healthStatus, setHealthStatus] = useState<Record<string, boolean>>({})

  // Poll for provider health when on the providers tab
  useEffect(() => {
    if (activeSubTab !== 'providers') return

    const fetchHealth = async () => {
      try {
        const status = await tauriIpc.aiGetHealthStatus()
        setHealthStatus(status)
      } catch (err) {
        console.error('Failed to fetch provider health:', err)
      }
    }

    fetchHealth()
    const interval = setInterval(fetchHealth, 30000)
    return () => clearInterval(interval)
  }, [activeSubTab])

  const updateProvider = (id: string, updates: Partial<ProviderConfig>) => {
    const nextProviders = settings.providers.map(p => 
      p.id === id ? { ...p, ...updates } : p
    )
    onChange({ ...settings, providers: nextProviders })
  }

  const updateRouting = (role: string, updates: Partial<AgentRoutingPolicy>) => {
    const nextRouting = settings.routing.map(r => 
      r.role === role ? { ...r, ...updates } : r
    )
    onChange({ ...settings, routing: nextRouting })
  }

  const handleCreatePlan = () => {
    const newPlan: ModelPlan = {
      id: crypto.randomUUID(),
      name: 'New Plan',
      description: 'Custom model orchestration plan',
      plannerModel: 'claude-3-5-sonnet-latest',
      builderModel: 'claude-3-5-sonnet-latest'
    }
    setEditingPlan(newPlan)
    setIsNewPlan(true)
  }

  const handleEditPlan = (plan: ModelPlan) => {
    setEditingPlan({ ...plan })
    setIsNewPlan(false)
  }

  const handleSavePlan = () => {
    if (!editingPlan) return

    let nextPlans: ModelPlan[]
    if (isNewPlan) {
      nextPlans = [...settings.plans, editingPlan]
    } else {
      nextPlans = settings.plans.map(p => p.id === editingPlan.id ? editingPlan : p)
    }

    onChange({ 
      ...settings, 
      plans: nextPlans,
      activePlanId: isNewPlan ? editingPlan.id : settings.activePlanId 
    })
    setEditingPlan(null)
  }

  const handleDeletePlan = (id: string) => {
    if (settings.plans.length <= 1) return // Keep at least one plan
    const nextPlans = settings.plans.filter(p => p.id !== id)
    const nextActiveId = settings.activePlanId === id ? nextPlans[0].id : settings.activePlanId
    onChange({ ...settings, plans: nextPlans, activePlanId: nextActiveId })
    setEditingPlan(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white/90">AI Runtime</h3>
          <p className="text-xs text-white/40">Manage your LLM providers and agent routing policies.</p>
        </div>
        
        <div className="flex gap-2">
          <div className="bg-white/5 border border-white/10 rounded-lg p-1 flex items-center">
            <span className="text-[10px] uppercase font-bold text-white/30 px-2">Strategy</span>
            <select
              value={settings.defaultStrategy}
              onChange={(e) => onChange({ ...settings, defaultStrategy: e.target.value })}
              className="bg-transparent text-xs text-white/70 focus:outline-none border-none pr-6"
            >
              <option value="quality">Quality First</option>
              <option value="cheap">Cheap First</option>
              <option value="latency">Latency First</option>
              <option value="auto">Auto (Plan)</option>
            </select>
          </div>

          <div className="flex bg-white/5 border border-white/10 rounded-lg p-1">
            <button 
              onClick={() => setActiveSubTab('plans')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                activeSubTab === 'plans' ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60"
              )}
            >
              Plans
            </button>
            <button 
              onClick={() => setActiveSubTab('providers')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                activeSubTab === 'providers' ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60"
              )}
            >
              Providers
            </button>
            <button 
              onClick={() => setActiveSubTab('routing')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                activeSubTab === 'routing' ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/60"
              )}
            >
              Routing
            </button>
          </div>
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeSubTab === 'plans' && (
          editingPlan ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 text-primary rounded-lg">
                    <Settings2 size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white/90">{isNewPlan ? 'Create New Plan' : 'Edit Model Plan'}</h4>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Plan Configuration</p>
                  </div>
                </div>
                <button 
                  onClick={() => setEditingPlan(null)}
                  className="text-xs text-white/40 hover:text-white/60 px-3 py-1 transition-colors"
                >
                  Cancel
                </button>
              </div>

              <div className="grid gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Plan Name</label>
                  <input 
                    type="text"
                    value={editingPlan.name}
                    onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                    placeholder="e.g., Performance Boost"
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white/80 focus:border-primary/40 focus:outline-none transition-all shadow-inner"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Description</label>
                  <textarea 
                    value={editingPlan.description}
                    onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                    placeholder="Describe how this plan optimizes your workflow..."
                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white/80 focus:border-primary/40 focus:outline-none transition-all min-h-[80px] resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Planner Model</label>
                    <input 
                      type="text"
                      value={editingPlan.plannerModel}
                      onChange={(e) => setEditingPlan({ ...editingPlan, plannerModel: e.target.value })}
                      placeholder="e.g., claude-3-5-sonnet-latest"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white/80 focus:border-primary/40 focus:outline-none transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">Builder Model</label>
                    <input 
                      type="text"
                      value={editingPlan.builderModel}
                      onChange={(e) => setEditingPlan({ ...editingPlan, builderModel: e.target.value })}
                      placeholder="e.g., claude-3-5-sonnet-latest"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white/80 focus:border-primary/40 focus:outline-none transition-all font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-white/5">
                {!isNewPlan && settings.plans.length > 1 && (
                  <button 
                    onClick={() => handleDeletePlan(editingPlan.id)}
                    className="text-xs text-red-400/60 hover:text-red-400 px-4 py-2 rounded-lg hover:bg-red-400/5 transition-all"
                  >
                    Delete Plan
                  </button>
                )}
                <div className="flex items-center gap-3 ml-auto">
                  <button 
                    onClick={() => setEditingPlan(null)}
                    className="text-xs text-white/40 hover:text-white/60 px-4 py-2 transition-colors"
                  >
                    Discard Changes
                  </button>
                  <button 
                    onClick={handleSavePlan}
                    className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-primary/10 active:scale-95"
                  >
                    <Zap size={14} className="fill-current" />
                    {isNewPlan ? 'Create Plan' : 'Update Plan'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-left-4 duration-300">
              {settings.plans.map(plan => (
                <div
                  key={plan.id}
                  className={cn(
                    "relative group flex flex-col items-start p-5 rounded-xl border transition-all text-left overflow-hidden",
                    settings.activePlanId === plan.id 
                      ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20" 
                      : "bg-white/5 border-white/10 hover:bg-white/10"
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      settings.activePlanId === plan.id ? "bg-primary/20 text-primary" : "bg-white/10 text-white/60"
                    )}>
                      <Zap size={18} />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {settings.activePlanId === plan.id && (
                        <div className="bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full">
                          Active
                        </div>
                      )}
                      <button 
                        onClick={() => handleEditPlan(plan)}
                        className="p-1.5 text-white/20 hover:text-white/60 hover:bg-white/5 rounded-md transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Settings2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  <button 
                    className="w-full text-left"
                    onClick={() => onChange({ ...settings, activePlanId: plan.id })}
                  >
                    <h4 className="text-sm font-bold text-white/90">{plan.name}</h4>
                    <p className="text-xs text-white/40 mt-1 line-clamp-2">{plan.description}</p>
                    
                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 w-full pt-4 border-t border-white/5">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-white/30 uppercase font-bold tracking-tighter">Planner</span>
                        <span className="text-[11px] text-white/70 block truncate font-mono">{plan.plannerModel}</span>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-white/30 uppercase font-bold tracking-tighter">Builder</span>
                        <span className="text-[11px] text-white/70 block truncate font-mono">{plan.builderModel}</span>
                      </div>
                    </div>
                  </button>
                </div>
              ))}
              
              <button 
                onClick={handleCreatePlan}
                className="flex flex-col items-center justify-center p-5 rounded-xl border border-dashed border-white/10 bg-black/20 hover:bg-white/5 transition-all text-white/40 hover:text-white/60 min-h-[160px] group"
              >
                <div className="p-3 bg-white/5 rounded-full mb-3 group-hover:scale-110 group-hover:bg-white/10 transition-all duration-300">
                  <Plus size={24} />
                </div>
                <span className="text-xs font-medium">Create Custom Plan</span>
              </button>
            </div>
          )
        )}

        {activeSubTab === 'providers' && (
          <div className="space-y-4">
            {settings.providers.map(provider => (
              <div key={provider.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-lg",
                      provider.enabled ? "bg-primary/20 text-primary" : "bg-white/10 text-white/40"
                    )}>
                      {provider.id === 'claude' && <Sparkles size={18} />}
                      {provider.id === 'gemini' && <Globe size={18} />}
                      {provider.id === 'openai' && <Cpu size={18} />}
                      {provider.id === 'ollama' && <Settings2 size={18} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white/90">{provider.name}</h4>
                        {provider.enabled && (
                          <div 
                            className={cn(
                              "w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]",
                              healthStatus[provider.id] !== false ? "bg-green-500" : "bg-red-500"
                            )} 
                            title={healthStatus[provider.id] !== false ? "Healthy" : "Degraded"}
                          />
                        )}
                      </div>
                      <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">
                        {provider.enabled ? 'Connected' : 'Disabled'}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => updateProvider(provider.id, { enabled: !provider.enabled })}
                    className={cn(
                      "w-10 h-6 rounded-full transition-colors relative",
                      provider.enabled ? "bg-primary" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full transition-all",
                      provider.enabled ? "right-1 bg-white" : "left-1 bg-white/40"
                    )} />
                  </button>
                </div>
                
                {provider.enabled && (
                  <div className="p-4 grid gap-4 md:grid-cols-2 animate-in slide-in-from-top-1 duration-200">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1.5">
                        <Key size={10} />
                        API Key
                      </label>
                      <input 
                        type="password"
                        value={provider.apiKey || ''}
                        onChange={(e) => updateProvider(provider.id, { apiKey: e.target.value })}
                        placeholder="sk-..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:border-primary/40 focus:outline-none transition-all"
                      />
                    </div>

                    {(provider.id === 'ollama' || provider.id === 'openai') && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1.5">
                          <Globe size={10} />
                          Base URL
                        </label>
                        <input 
                          type="text"
                          value={provider.baseUrl || ''}
                          onChange={(e) => updateProvider(provider.id, { baseUrl: e.target.value })}
                          placeholder={provider.id === 'ollama' ? "http://localhost:11434" : "https://api.openai.com/v1"}
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:border-primary/40 focus:outline-none transition-all"
                        />
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1.5">
                        <Layout size={10} />
                        Default Model
                      </label>
                      <select
                        value={provider.defaultModel || ''}
                        onChange={(e) => updateProvider(provider.id, { defaultModel: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:border-primary/40 focus:outline-none transition-all"
                      >
                        {provider.models.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeSubTab === 'routing' && (
          <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/40">Agent Role</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/40">Active Plan</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/40">Provider Override</th>
                    <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-white/40">Model Override</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {settings.routing.map(policy => (
                    <tr key={policy.role} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <ShieldCheck size={14} className="text-primary/60" />
                          <span className="text-sm font-medium text-white/90 capitalize">{policy.role}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={policy.planId || ''}
                          onChange={(e) => updateRouting(policy.role, { planId: e.target.value })}
                          className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/80 focus:outline-none"
                        >
                          {settings.plans.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={policy.providerOverride || ''}
                          onChange={(e) => updateRouting(policy.role, { providerOverride: e.target.value || undefined })}
                          className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/80 focus:outline-none"
                        >
                          <option value="">None (Use Plan)</option>
                          {settings.providers.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-4">
                        <input 
                          type="text"
                          value={policy.modelOverride || ''}
                          onChange={(e) => updateRouting(policy.role, { modelOverride: e.target.value || undefined })}
                          placeholder="Override model..."
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/80 focus:outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
