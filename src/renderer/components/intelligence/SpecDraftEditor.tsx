import React, { useState, useEffect } from 'react'
import { 
  Plus, 
  Zap, 
  FileCode, 
  ChevronRight, 
  RefreshCw, 
  Check, 
  X, 
  FileEdit, 
  CheckCircle2, 
  AlertCircle,
  Save,
  ArrowLeft,
  Layout,
  ListTodo,
  Tag
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { KSpecDraft, ExtendedApi } from '../../api/types'

interface SpecDraftEditorProps {
  api: ExtendedApi
  projectPath: string
  drafts: KSpecDraft[]
  loading: boolean
  onRefresh: () => void
}

export function SpecDraftEditor({ 
  api, 
  projectPath, 
  drafts, 
  loading, 
  onRefresh 
}: SpecDraftEditorProps) {
  const [selectedDraft, setSelectedDraft] = useState<KSpecDraft | null>(null)
  const [draftContent, setDraftContent] = useState('')
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [showDraftForm, setShowDraftForm] = useState(false)
  const [newDraftModuleId, setNewDraftModuleId] = useState('')
  const [viewMode, setViewMode] = useState<'editor' | 'form' | 'preview'>('form')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const getDraftModuleId = (draft: KSpecDraft) => draft.moduleId || draft.id
  const getDraftUpdatedAt = (draft: KSpecDraft) => draft.updatedAt || draft.lastModified || Date.now()

  // --- YAML Parsing & Serialization ---
  
  const parseKSpec = (yaml: string) => {
    const lines = yaml.split('\n')
    const getValue = (key: string) => lines.find(l => l.startsWith(`${key}:`))?.split(':')[1]?.trim().replace(/^['"]|['"]$/g, '') || ''
    
    // Simple AC parser
    const acs: any[] = []
    let currentAc: any = null
    let currentField: string | null = null
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trim()
      
      if (trimmed.startsWith('- id:')) {
        if (currentAc) acs.push(currentAc)
        currentAc = { id: trimmed.split(':')[1]?.trim() || '', given: '', when: '', then: '' }
        currentField = null
      } else if (currentAc) {
        if (trimmed.startsWith('given:')) {
          currentField = 'given'
          if (trimmed.includes('|')) currentAc.given = ''
          else currentAc.given = trimmed.split(':')[1]?.trim() || ''
        } else if (trimmed.startsWith('when:')) {
          currentField = 'when'
          if (trimmed.includes('|')) currentAc.when = ''
          else currentAc.when = trimmed.split(':')[1]?.trim() || ''
        } else if (trimmed.startsWith('then:')) {
          currentField = 'then'
          if (trimmed.includes('|')) currentAc.then = ''
          else currentAc.then = trimmed.split(':')[1]?.trim() || ''
        } else if (line.startsWith('      ') && currentField) {
          currentAc[currentField] += (currentAc[currentField] ? '\n' : '') + line.substring(6)
        }
      }
    }
    if (currentAc) acs.push(currentAc)

    return {
      title: getValue('title'),
      type: getValue('type'),
      description: yaml.match(/description: >-\s+([\s\S]*?)(?=\n\S|$)/)?.[1]?.trim() || '',
      maturity: yaml.match(/maturity:\s+(\S+)/)?.[1] || 'draft',
      acceptance_criteria: acs
    }
  }

  const toYaml = (data: any) => {
    let yaml = `title: ${data.title}\ntype: ${data.type}\nstatus:\n  maturity: ${data.maturity}\ndescription: >-\n  ${data.description.replace(/\n/g, '\n  ')}\nacceptance_criteria:\n`
    data.acceptance_criteria.forEach((ac: any) => {
      yaml += `  - id: ${ac.id}\n`
      yaml += `    given: |\n      ${ac.given.replace(/\n/g, '\n      ')}\n`
      yaml += `    when: |\n      ${ac.when.replace(/\n/g, '\n      ')}\n`
      yaml += `    then: |\n      ${ac.then.replace(/\n/g, '\n      ')}\n`
    })
    return yaml
  }

  const [formData, setFormData] = useState<any>(null)

  useEffect(() => {
    if (selectedDraft) {
      setFormData(parseKSpec(draftContent))
    }
  }, [selectedDraft, draftContent])

  const updateFormField = (field: string, value: any) => {
    const newData = { ...formData, [field]: value }
    setFormData(newData)
    setDraftContent(toYaml(newData))
  }

  const updateAcField = (index: number, field: string, value: string) => {
    const newAcs = [...formData.acceptance_criteria]
    newAcs[index] = { ...newAcs[index], [field]: value }
    updateFormField('acceptance_criteria', newAcs)
  }

  const addAc = () => {
    const newAcs = [...formData.acceptance_criteria, { id: `ac-${formData.acceptance_criteria.length + 1}`, given: '', when: '', then: '' }]
    updateFormField('acceptance_criteria', newAcs)
  }

  const removeAc = (index: number) => {
    const newAcs = formData.acceptance_criteria.filter((_: any, i: number) => i !== index)
    updateFormField('acceptance_criteria', newAcs)
  }

  const validateDraftContent = (content: string): string[] => {
    const trimmed = content.trim()
    const errors: string[] = []
    if (!trimmed) errors.push('Draft content is empty.')
    if (!/^title:\s+\S+/m.test(trimmed)) errors.push('Missing top-level title.')
    if (!/^type:\s+\S+/m.test(trimmed)) errors.push('Missing top-level type.')
    if (!/^status:\s*$/m.test(trimmed) && !/^status:\s+\S+/m.test(trimmed) && !/maturity:/m.test(trimmed)) errors.push('Missing status block.')
    if (!/acceptance_criteria:/m.test(trimmed)) errors.push('Missing acceptance_criteria section.')
    return errors
  }

  const draftValidation = validateDraftContent(draftContent)

  const handleOpenDraft = (draft: KSpecDraft) => {
    setSelectedDraft(draft)
    setDraftContent(draft.content || '')
    setViewMode('form')
  }

  const handleSaveDraft = async () => {
    if (!selectedDraft) return
    if (draftValidation.length > 0) {
      setErrorMessage(draftValidation[0])
      return
    }
    setErrorMessage(null)
    setIsSavingDraft(true)
    try {
      await api.kspecWriteDraft(projectPath, getDraftModuleId(selectedDraft), draftContent)
      onRefresh()
      setSelectedDraft(null)
    } catch (err) {
      console.error('Failed to save draft:', err)
      setErrorMessage('Failed to save draft. Check backend logs.')
    } finally {
      setIsSavingDraft(false)
    }
  }

  const handleCreateDraft = async () => {
    if (!newDraftModuleId.trim()) return
    setIsSavingDraft(true)
    try {
      const template = `title: ${newDraftModuleId}\ntype: module\nstatus:\n  maturity: draft\ndescription: >-\n  Add description here\nacceptance_criteria:\n  - id: ac-1\n    given: |\n      context\n    when: |\n      action\n    then: |\n      result\n`
      await api.kspecWriteDraft(projectPath, newDraftModuleId, template)
      setNewDraftModuleId('')
      setShowDraftForm(false)
      onRefresh()
    } catch (err) {
      console.error('Failed to create draft:', err)
    } finally {
      setIsSavingDraft(false)
    }
  }

  if (selectedDraft) {
    return (
      <div className="flex flex-col h-full space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setSelectedDraft(null)}
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Drafts
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 bg-white/5 rounded-md border border-white/10">
              <button
                onClick={() => setViewMode('form')}
                className={cn(
                  "px-2 py-1 rounded text-[9px] font-bold transition-all",
                  viewMode === 'form' ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
                )}
              >
                Form
              </button>
              <button
                onClick={() => setViewMode('editor')}
                className={cn(
                  "px-2 py-1 rounded text-[9px] font-bold transition-all",
                  viewMode === 'editor' ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
                )}
              >
                YAML
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={cn(
                  "px-2 py-1 rounded text-[9px] font-bold transition-all",
                  viewMode === 'preview' ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
                )}
              >
                Preview
              </button>
            </div>
            <button 
              disabled={isSavingDraft || (draftValidation.length > 0 && viewMode === 'editor')}
              onClick={handleSaveDraft}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-all"
            >
              {isSavingDraft ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
              Save Draft
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
            <FileCode size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-bold text-white/90 truncate">{getDraftModuleId(selectedDraft)}</h3>
            <p className="text-[10px] text-white/30">YAML Specification Draft</p>
          </div>
        </div>
        
        <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
          {viewMode === 'form' && formData ? (
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-2">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Title</label>
                    <input 
                      value={formData.title}
                      onChange={e => updateFormField('title', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white focus:border-purple-500/50 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Type</label>
                    <select 
                      value={formData.type}
                      onChange={e => updateFormField('type', e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white focus:border-purple-500/50 outline-none appearance-none"
                    >
                      <option value="module">Module</option>
                      <option value="feature">Feature</option>
                      <option value="requirement">Requirement</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Description</label>
                  <textarea 
                    value={formData.description}
                    onChange={e => updateFormField('description', e.target.value)}
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white focus:border-purple-500/50 outline-none resize-none"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Acceptance Criteria</label>
                  <button 
                    onClick={addAc}
                    className="p-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                
                <div className="space-y-3">
                  {formData.acceptance_criteria.map((ac: any, idx: number) => (
                    <div key={idx} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 relative group">
                      <button 
                        onClick={() => removeAc(idx)}
                        className="absolute top-3 right-3 text-white/10 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X size={14} />
                      </button>
                      
                      <div className="flex items-center gap-2 mb-1">
                        <div className="text-[10px] font-bold text-purple-400/80 uppercase">ID:</div>
                        <input 
                          value={ac.id}
                          onChange={e => updateAcField(idx, 'id', e.target.value)}
                          className="bg-transparent border-none p-0 text-[10px] font-bold text-white/60 focus:outline-none focus:text-white"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <div className="flex flex-col gap-1">
                          <div className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">Given</div>
                          <textarea 
                            value={ac.given}
                            onChange={e => updateAcField(idx, 'given', e.target.value)}
                            rows={1}
                            placeholder="context..."
                            className="bg-black/20 border border-white/5 rounded p-1.5 text-[10px] text-white/80 focus:border-purple-500/30 outline-none resize-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">When</div>
                          <textarea 
                            value={ac.when}
                            onChange={e => updateAcField(idx, 'when', e.target.value)}
                            rows={1}
                            placeholder="action..."
                            className="bg-black/20 border border-white/5 rounded p-1.5 text-[10px] text-white/80 focus:border-purple-500/30 outline-none resize-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">Then</div>
                          <textarea 
                            value={ac.then}
                            onChange={e => updateAcField(idx, 'then', e.target.value)}
                            rows={1}
                            placeholder="result..."
                            className="bg-black/20 border border-white/5 rounded p-1.5 text-[10px] text-white/80 focus:border-purple-500/30 outline-none resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  {formData.acceptance_criteria.length === 0 && (
                    <div className="p-8 text-center border border-dashed border-white/5 rounded-2xl text-[10px] text-white/20">
                      No ACs added. Click the plus icon to add one.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : viewMode === 'editor' ? (
            <>
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest">YAML Source</label>
                <span className={cn(
                  "text-[9px] font-bold uppercase tracking-wider",
                  draftValidation.length === 0 ? "text-emerald-400" : "text-amber-400"
                )}>
                  {draftValidation.length === 0 ? 'Valid draft shape' : `${draftValidation.length} issues`}
                </span>
              </div>
              <div className="flex-1 brainstorm-card p-4">
                <textarea
                  autoFocus
                  className="spec-editor-textarea custom-scrollbar"
                  value={draftContent}
                  onChange={e => setDraftContent(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
              <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1">Visual Preview</div>
              <SpecVisualPreview content={draftContent} />
            </div>
          )}
        </div>
        
        <div className="p-3 bg-purple-500/5 rounded-xl border border-purple-500/10 flex items-start gap-2">
          {draftValidation.length === 0 ? (
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
          )}
          <p className="text-[10px] text-white/40 leading-normal">
            {draftValidation.length === 0
              ? 'Saving this draft updates the local .kspec/modules/drafts/ file in the shadow branch.'
              : draftValidation.join(' ')}
          </p>
        </div>
        {errorMessage && (
          <div className="text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg p-2 animate-in slide-in-from-bottom-1 duration-200">
            {errorMessage}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
       {/* Spec Drafts List */}
       <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/30 flex items-center gap-1.5">
            <Zap size={10} />
            KSpec Drafts
          </h4>
          {!showDraftForm && (
            <button 
              onClick={() => setShowDraftForm(true)}
              className="p-1 rounded bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all"
            >
              <Plus size={12} />
            </button>
          )}
        </div>

        {showDraftForm && (
          <div className="p-3 rounded-xl bg-black/40 border border-purple-500/30 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-purple-400">New Module Spec</h4>
              <button onClick={() => setShowDraftForm(false)} className="text-white/20 hover:text-white/60">
                <X size={14} />
              </button>
            </div>
            <input 
              autoFocus
              placeholder="Module ID (e.g. auth-provider)"
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50"
              value={newDraftModuleId}
              onChange={e => setNewDraftModuleId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateDraft()}
            />
            <button 
              disabled={!newDraftModuleId.trim() || isSavingDraft}
              onClick={handleCreateDraft}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all"
            >
              {isSavingDraft ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              Create Draft
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2 py-4">
            <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
            <div className="h-12 bg-white/5 rounded-xl animate-pulse" />
          </div>
        ) : drafts.length > 0 ? (
          drafts.map((draft, i) => (
            <div 
              key={i} 
              onClick={() => handleOpenDraft(draft)}
              className="p-3 brainstorm-card group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                  <FileCode size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white/90 truncate group-hover:text-purple-300 transition-colors">
                    {getDraftModuleId(draft)}
                  </div>
                  <div className="text-[9px] text-white/30 flex items-center gap-2">
                    <span>{new Date(getDraftUpdatedAt(draft)).toLocaleTimeString()}</span>
                    <span className="w-1 h-1 rounded-full bg-white/10" />
                    <span>YAML Spec</span>
                  </div>
                </div>
                <ChevronRight size={14} className="text-white/10 group-hover:text-white/40 transition-colors" />
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-white/[0.02] rounded-2xl border border-dashed border-white/5">
            <FileEdit size={24} className="text-white/10 mb-2" />
            <p className="text-[10px] text-white/30 leading-relaxed">
              No active drafts.<br />Start drafting requirements to sync with KSpec.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function SpecVisualPreview({ content }: { content: string }) {
  // Simple parser for YAML preview
  const lines = content.split('\n')
  const title = lines.find(l => l.startsWith('title:'))?.split(':')[1]?.trim() || 'Untitled'
  const type = lines.find(l => l.startsWith('type:'))?.split(':')[1]?.trim() || 'module'
  const description = lines.find(l => l.startsWith('description:')) ? '...' : ''
  
  const acs: string[] = []
  let inAcs = false
  for (const line of lines) {
    if (line.trim().startsWith('acceptance_criteria:')) {
      inAcs = true
      continue
    }
    if (inAcs && line.trim().startsWith('- id:')) {
      acs.push(line.split(':')[1]?.trim() || 'AC')
    }
    if (inAcs && line && !line.startsWith(' ') && !line.startsWith('-')) {
      // End of AC section
      // inAcs = false
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/10">
        <div className="flex items-center gap-2 mb-2">
          <Layout size={14} className="text-indigo-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">{type}</span>
        </div>
        <h2 className="text-lg font-bold text-white/90">{title}</h2>
      </div>

      <div className="space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/20 flex items-center gap-2">
          <ListTodo size={12} />
          Acceptance Criteria
        </h4>
        <div className="space-y-2">
          {acs.map((ac, i) => (
            <div key={i} className="p-3 bg-white/5 rounded-lg border border-white/5 flex items-center gap-3">
              <div className="w-6 h-6 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Check size={12} />
              </div>
              <span className="text-xs text-white/70">{ac}</span>
            </div>
          ))}
          {acs.length === 0 && (
            <div className="text-[10px] text-white/20 italic">No ACs detected in draft.</div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-white/20 flex items-center gap-2">
          <Tag size={12} />
          Traits & Metadata
        </h4>
        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[9px] text-white/40">version: 1.0.0</span>
          <span className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[9px] text-white/40">automation: eligible</span>
        </div>
      </div>
    </div>
  )
}
