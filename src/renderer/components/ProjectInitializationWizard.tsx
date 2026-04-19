import React, { useState, useEffect } from 'react'
import { Folder, Search, Wand2, CheckCircle2, AlertCircle, X, ChevronRight, ChevronLeft, Loader2, Info, Boxes, Cpu, Activity } from 'lucide-react'
import { useProjectWizard } from '../hooks/useProjectWizard'
import { Api } from '../api'
import { cn } from '../lib/utils'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface ProjectInitializationWizardProps {
  isOpen: boolean
  onClose: () => void
  onProjectCreated: (projectPath: string, projectName: string) => void
  api: Api
}

export function ProjectInitializationWizard({ isOpen, onClose, onProjectCreated, api }: ProjectInitializationWizardProps) {
  const wizard = useProjectWizard(api)
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen)
  const [selectedPreset, setSelectedPreset] = useState('standard')
  const [projectName, setProjectName] = useState('')
  const [taskBackend, setTaskBackend] = useState('beads')

  useEffect(() => {
    if (isOpen) {
      wizard.reset()
      setProjectName('')
      setSelectedPreset('standard')
      setTaskBackend('beads')
    }
  }, [isOpen])

  useEffect(() => {
    if (wizard.scan && !projectName) {
      const folderName = wizard.path.split(/[/\\]/).pop() || ''
      setProjectName(folderName)
    }
    if (wizard.scan?.upgradeInputs.recommendedPreset) {
      setSelectedPreset(wizard.scan.upgradeInputs.recommendedPreset)
    }
  }, [wizard.scan])

  const handleSelectDirectory = async () => {
    // @ts-ignore
    const dir = await window.electronAPI?.selectDirectory()
    if (dir) {
      wizard.setPath(dir)
      wizard.startScan(dir)
    }
  }

  const handleGenerateProposal = () => {
    wizard.generateProposal(selectedPreset, projectName, taskBackend)
  }

  const handleApply = async () => {
    await wizard.applyProposal()
  }

  const handleFinish = () => {
    onProjectCreated(wizard.path, projectName)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div 
        ref={focusTrapRef}
        className="codex-modal-content w-full max-w-3xl min-h-[500px] max-h-[80vh] rounded-[var(--radius-modal)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
              <Wand2 size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Project Initialization</h2>
              <p className="text-xs text-white/40 mt-0.5">Automate your project setup & capabilities</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X size={20} className="text-white/40" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {/* Progress Stepper */}
          <div className="flex items-center justify-center mb-12">
            {[
              { id: 'path', label: 'Select' },
              { id: 'detection', label: 'Detect' },
              { id: 'proposal', label: 'Review' },
              { id: 'finished', label: 'Finish' }
            ].map((s, i, arr) => (
              <React.Fragment key={s.id}>
                <div className="flex flex-col items-center relative">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                    wizard.step === s.id || (wizard.step === 'scanning' && s.id === 'path') || (wizard.step === 'applying' && s.id === 'proposal')
                      ? "bg-primary text-black shadow-lg shadow-primary/20 scale-110"
                      : (arr.findIndex(x => x.id === wizard.step) > i || wizard.step === 'finished' ? "bg-green-500/20 text-green-500" : "bg-white/5 text-white/20")
                  )}>
                    {arr.findIndex(x => x.id === wizard.step) > i || wizard.step === 'finished' ? <CheckCircle2 size={16} /> : i + 1}
                  </div>
                  <span className={cn(
                    "text-[10px] mt-2 font-medium uppercase tracking-wider",
                    wizard.step === s.id ? "text-white" : "text-white/20"
                  )}>{s.label}</span>
                </div>
                {i < arr.length - 1 && (
                  <div className={cn(
                    "w-12 h-[2px] mx-2 -mt-6 transition-colors duration-300",
                    arr.findIndex(x => x.id === wizard.step) > i ? "bg-green-500/40" : "bg-white/5"
                  )} />
                )}
              </React.Fragment>
            ))}
          </div>

          <div className="max-w-xl mx-auto">
            {wizard.step === 'path' && (
              <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-300">
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-medium text-white">Where is your project?</h3>
                  <p className="text-sm text-white/40">Select the root directory of the project you want to initialize.</p>
                </div>

                <div className="p-6 bg-white/5 border border-white/10 rounded-xl space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-black/40 rounded-lg border border-white/5">
                    <Folder className="text-white/20" size={20} />
                    <input 
                      type="text" 
                      value={wizard.path}
                      onChange={(e) => wizard.setPath(e.target.value)}
                      placeholder="/path/to/your/project"
                      className="flex-1 bg-transparent border-none text-sm text-white focus:ring-0"
                    />
                    <button 
                      onClick={handleSelectDirectory}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-xs font-medium transition-colors"
                    >
                      Browse
                    </button>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                    <Info size={16} className="text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-white/60 leading-relaxed">
                      The wizard will scan for project markers (package.json, .git, etc.) to propose the best configuration.
                    </p>
                  </div>
                </div>

                <div className="flex justify-center">
                  <button
                    disabled={!wizard.path || wizard.loading}
                    onClick={() => wizard.startScan(wizard.path)}
                    className="flex items-center gap-2 bg-white text-black hover:bg-white/90 px-6 py-3 rounded-lg font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Start Scanning
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {(wizard.step === 'scanning' || wizard.step === 'applying') && (
              <div className="flex flex-col items-center justify-center py-12 space-y-6 animate-in fade-in duration-300">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    {wizard.step === 'scanning' ? <Search size={32} className="text-primary/60" /> : <Activity size={32} className="text-primary/60" />}
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-medium text-white">
                    {wizard.step === 'scanning' ? 'Analyzing Project...' : 'Applying Configuration...'}
                  </h3>
                  <p className="text-sm text-white/40">This will only take a moment.</p>
                </div>
              </div>
            )}

            {wizard.step === 'detection' && wizard.scan && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-white/60 text-xs font-bold uppercase tracking-widest">
                      <Boxes size={14} />
                      Markers Detected
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {wizard.scan.markers.map(m => (
                        <span key={m.id} className="px-2 py-1 bg-white/5 rounded text-[10px] text-white/80 border border-white/5">
                          {m.id}
                        </span>
                      ))}
                      {wizard.scan.markers.length === 0 && <span className="text-white/20 text-[10px]">None detected</span>}
                    </div>
                  </div>

                  <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                    <div className="flex items-center gap-2 text-white/60 text-xs font-bold uppercase tracking-widest">
                      <Cpu size={14} />
                      Capabilities
                    </div>
                    <div className="space-y-1.5">
                      {wizard.scan.capabilities.slice(0, 4).map(c => (
                        <div key={c.id} className="flex items-center justify-between text-[10px]">
                          <span className="text-white/60">{c.id}</span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded-full font-bold",
                            c.installed ? "bg-green-500/10 text-green-500" : "bg-white/5 text-white/20"
                          )}>
                            {c.installed ? 'Found' : 'Missing'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-white/5 border border-white/10 rounded-xl space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white/80">Project Name</label>
                    <input 
                      type="text" 
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-white/80">Initialization Preset</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'minimal', label: 'Minimal', desc: 'Just the manifest' },
                        { id: 'standard', label: 'Standard', desc: 'Typical setup' },
                        { id: 'full', label: 'Full', desc: 'All features' }
                      ].map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSelectedPreset(p.id)}
                          disabled={p.id === 'full' && !wizard.scan?.upgradeInputs.canProposeFull}
                          className={cn(
                            "flex flex-col items-center gap-1 p-3 rounded-lg border transition-all text-center group",
                            selectedPreset === p.id 
                              ? "bg-primary/10 border-primary text-white shadow-lg shadow-primary/5" 
                              : "bg-white/5 border-white/5 text-white/40 hover:border-white/20"
                          )}
                        >
                          <span className="text-xs font-bold">{p.label}</span>
                          <span className="text-[9px] opacity-40 group-hover:opacity-60">{p.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium text-white/80">Default Task Backend</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'beads', label: 'Beads (bd)', desc: 'Advanced git tasks' },
                        { id: 'kspec', label: 'Kspec', desc: 'Knowledge spec' }
                      ].map(b => (
                        <button
                          key={b.id}
                          onClick={() => setTaskBackend(b.id)}
                          className={cn(
                            "flex flex-col items-start gap-1 p-3 rounded-lg border transition-all group",
                            taskBackend === b.id 
                              ? "bg-primary/10 border-primary text-white shadow-lg shadow-primary/5" 
                              : "bg-white/5 border-white/5 text-white/40 hover:border-white/20"
                          )}
                        >
                          <span className="text-xs font-bold">{b.label}</span>
                          <span className="text-[9px] opacity-40 group-hover:opacity-60">{b.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4">
                  <button
                    onClick={() => wizard.setStep('path')}
                    className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm font-medium"
                  >
                    <ChevronLeft size={18} />
                    Back
                  </button>
                  <button
                    onClick={handleGenerateProposal}
                    className="flex items-center gap-2 bg-white text-black hover:bg-white/90 px-6 py-3 rounded-lg font-bold transition-all active:scale-95 shadow-lg shadow-white/5"
                  >
                    Review Proposal
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}

            {wizard.step === 'proposal' && wizard.proposal && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-medium text-white">Review Proposal</h3>
                  <p className="text-sm text-white/40">{wizard.proposal.summary}</p>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-white/5 bg-white/5">
                    <h4 className="text-xs font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
                      <Activity size={14} />
                      Operations to Perform
                    </h4>
                  </div>
                  <div className="divide-y divide-white/5 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {wizard.proposal.operations.map(op => (
                      <div key={op.id} className="p-4 flex items-start gap-4 hover:bg-white/5 transition-colors">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          op.kind === 'create_file' ? "bg-green-500/20 text-green-500" : "bg-blue-500/20 text-blue-500"
                        )}>
                          {op.kind === 'create_file' ? <CheckCircle2 size={16} /> : <Info size={16} />}
                        </div>
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-white/90">{op.path}</div>
                          <div className="text-xs text-white/40 leading-relaxed">{op.reason}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {wizard.proposal.warnings.length > 0 && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                    <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h5 className="text-xs font-bold text-amber-500 uppercase tracking-widest">Important Notes</h5>
                      {wizard.proposal.warnings.map(w => (
                        <p key={w.id} className="text-xs text-amber-500/80 leading-relaxed">{w.detail}</p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-4">
                  <button
                    onClick={() => wizard.setStep('detection')}
                    className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-sm font-medium"
                  >
                    <ChevronLeft size={18} />
                    Back
                  </button>
                  <button
                    onClick={handleApply}
                    className="flex items-center gap-2 bg-primary text-black hover:bg-primary/90 px-8 py-3 rounded-lg font-bold transition-all active:scale-95 shadow-lg shadow-primary/20"
                  >
                    <Wand2 size={18} />
                    Apply & Initialize
                  </button>
                </div>
              </div>
            )}

            {wizard.step === 'finished' && (
              <div className="flex flex-col items-center justify-center py-12 space-y-8 animate-in zoom-in-95 duration-500">
                <div className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 shadow-2xl shadow-green-500/20">
                  <CheckCircle2 size={48} />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-bold text-white">Initialization Complete!</h3>
                  <p className="text-sm text-white/40">
                    Project <span className="text-white font-medium">{projectName}</span> has been successfully configured.
                  </p>
                </div>

                <div className="w-full max-w-sm p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                  <div className="text-xs font-bold text-white/40 uppercase tracking-widest">Modified Files</div>
                  <div className="space-y-1.5">
                    {wizard.appliedFiles.map(f => (
                      <div key={f} className="text-[11px] text-white/60 font-mono truncate">{f}</div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleFinish}
                  className="bg-white text-black hover:bg-white/90 px-10 py-4 rounded-xl font-bold transition-all active:scale-95 shadow-xl shadow-white/5"
                >
                  Start Working
                </button>
              </div>
            )}

            {wizard.step === 'error' && (
              <div className="flex flex-col items-center justify-center py-12 space-y-6 animate-in shake duration-500">
                <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center text-red-500">
                  <AlertCircle size={40} />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-medium text-white">Something went wrong</h3>
                  <p className="text-sm text-red-500/80 max-w-md mx-auto">{wizard.error}</p>
                </div>
                <button
                  onClick={() => wizard.setStep('path')}
                  className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
