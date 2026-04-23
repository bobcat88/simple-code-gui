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

interface AiRuntimeSettingsProps {
  settings: AiRuntimeSettingsType
  onChange: (settings: AiRuntimeSettingsType) => void
}

export function AiRuntimeSettings({ settings, onChange }: AiRuntimeSettingsProps): React.ReactElement {
  const [activeSubTab, setActiveSubTab] = useState<'plans' | 'providers' | 'routing'>('plans')

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white/90">AI Runtime</h3>
          <p className="text-xs text-white/40">Manage your LLM providers and agent routing policies.</p>
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

      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeSubTab === 'plans' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {settings.plans.map(plan => (
              <button
                key={plan.id}
                onClick={() => onChange({ ...settings, activePlanId: plan.id })}
                className={cn(
                  "relative group flex flex-col items-start p-5 rounded-xl border transition-all text-left",
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
                  {settings.activePlanId === plan.id && (
                    <div className="bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full">
                      Active
                    </div>
                  )}
                </div>
                
                <h4 className="text-sm font-bold text-white/90">{plan.name}</h4>
                <p className="text-xs text-white/40 mt-1 line-clamp-2">{plan.description}</p>
                
                <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 w-full pt-4 border-t border-white/5">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-white/30 uppercase font-bold tracking-tighter">Planner</span>
                    <span className="text-[11px] text-white/70 block truncate">{plan.plannerModel}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-white/30 uppercase font-bold tracking-tighter">Builder</span>
                    <span className="text-[11px] text-white/70 block truncate">{plan.builderModel}</span>
                  </div>
                </div>
              </button>
            ))}
            
            <button className="flex flex-col items-center justify-center p-5 rounded-xl border border-dashed border-white/10 bg-black/20 hover:bg-white/5 transition-all text-white/40 hover:text-white/60 min-h-[160px]">
              <Plus size={24} className="mb-2" />
              <span className="text-xs font-medium">New Plan</span>
            </button>
          </div>
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
                      <h4 className="text-sm font-bold text-white/90">{provider.name}</h4>
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
