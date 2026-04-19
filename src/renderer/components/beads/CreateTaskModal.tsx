import React from 'react'
import ReactDOM from 'react-dom'
import type { BackendKind, AutomationEligibility } from './adapters/types.js'
import { VoiceControls } from '../VoiceControls.js'
import { Mic } from 'lucide-react'
import { useState, useCallback } from 'react'

const BEADS_TYPES = [
  { value: 'task', label: 'Task' },
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'epic', label: 'Epic' },
  { value: 'chore', label: 'Chore' },
] as const

const KSPEC_TYPES = [
  { value: 'task', label: 'Task' },
  { value: 'bug', label: 'Bug' },
  { value: 'epic', label: 'Epic' },
  { value: 'spike', label: 'Spike' },
  { value: 'infra', label: 'Infra' },
] as const

const BEADS_PRIORITIES = [
  { value: 0, label: 'P0 - Critical' },
  { value: 1, label: 'P1 - High' },
  { value: 2, label: 'P2 - Medium' },
  { value: 3, label: 'P3 - Low' },
  { value: 4, label: 'P4 - Lowest' },
] as const

const KSPEC_PRIORITIES = [
  { value: 1, label: 'P1 - Highest' },
  { value: 2, label: 'P2 - High' },
  { value: 3, label: 'P3 - Medium' },
  { value: 4, label: 'P4 - Low' },
  { value: 5, label: 'P5 - Lowest' },
] as const

const AUTOMATION_OPTIONS = [
  { value: '', label: 'Unassessed' },
  { value: 'eligible', label: 'Eligible' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'manual_only', label: 'Manual Only' },
] as const

interface CreateTaskModalProps {
  show: boolean
  onClose: () => void
  onCreate: () => void
  backendKind: BackendKind
  title: string
  setTitle: (title: string) => void
  type: string
  setType: (type: string) => void
  priority: number
  setPriority: (priority: number) => void
  description: string
  setDescription: (description: string) => void
  labels: string
  setLabels: (labels: string) => void
  automation?: AutomationEligibility | ''
  setAutomation?: (automation: AutomationEligibility | '') => void
}

export function CreateTaskModal({
  show, onClose, onCreate, backendKind,
  title, setTitle,
  type, setType,
  priority, setPriority,
  description, setDescription,
  labels, setLabels,
  automation, setAutomation
}: CreateTaskModalProps) {
  const [activeVoiceField, setActiveVoiceField] = useState<'title' | 'description' | null>(null)

  const handleTranscription = useCallback((text: string) => {
    if (!text.trim()) return
    if (activeVoiceField === 'title') {
      setTitle(title + (title ? ' ' : '') + text.trim())
    } else if (activeVoiceField === 'description') {
      setDescription(description + (description ? ' ' : '') + text.trim())
    }
  }, [activeVoiceField, title, description, setTitle, setDescription])

  if (!show) return null

  const isKspec = backendKind === 'kspec'
  const types = isKspec ? KSPEC_TYPES : BEADS_TYPES
  const priorities = isKspec ? KSPEC_PRIORITIES : BEADS_PRIORITIES

  return ReactDOM.createPortal(
    <div className="beads-modal-overlay" onClick={onClose}>
      <div className="beads-modal" onClick={(e) => e.stopPropagation()}>
        <div className="beads-modal-header">
          <h3>Create Task</h3>
          <button className="beads-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="beads-modal-body">
          <div className="beads-form-group">
            <div className="flex items-center justify-between">
              <label htmlFor="task-title">Title *</label>
              <button 
                className={`beads-voice-btn ${activeVoiceField === 'title' ? 'active' : ''}`}
                onClick={() => setActiveVoiceField(activeVoiceField === 'title' ? null : 'title')}
                title="Voice Input"
              >
                <Mic size={14} />
              </button>
            </div>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && title.trim()) {
                  e.preventDefault()
                  onCreate()
                }
                if (e.key === 'Escape') onClose()
              }}
            />
          </div>
          <div className="beads-form-row">
            <div className="beads-form-group">
              <label htmlFor="task-type">Type</label>
              <select id="task-type" value={type} onChange={(e) => setType(e.target.value)}>
                {types.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="beads-form-group">
              <label htmlFor="task-priority">Priority</label>
              <select id="task-priority" value={priority} onChange={(e) => setPriority(parseInt(e.target.value))}>
                {priorities.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
          {isKspec && setAutomation && (
            <div className="beads-form-group">
              <label htmlFor="task-automation">Automation</label>
              <select
                id="task-automation"
                value={automation ?? ''}
                onChange={(e) => setAutomation(e.target.value as AutomationEligibility | '')}
              >
                {AUTOMATION_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          )}
          <div className="beads-form-group">
            <div className="flex items-center justify-between">
              <label htmlFor="task-description">Description</label>
              <button 
                className={`beads-voice-btn ${activeVoiceField === 'description' ? 'active' : ''}`}
                onClick={() => setActiveVoiceField(activeVoiceField === 'description' ? null : 'description')}
                title="Voice Input"
              >
                <Mic size={14} />
              </button>
            </div>
            <textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
            />
          </div>

          {activeVoiceField && (
            <div className="beads-modal-voice-panel">
              <VoiceControls 
                activeTabId="beads-create" 
                onTranscription={handleTranscription}
              />
              <div className="text-[10px] text-muted-foreground mt-1 text-center font-medium opacity-70">
                Dictating into {activeVoiceField === 'title' ? 'Title' : 'Description'}...
              </div>
            </div>
          )}
          <div className="beads-form-group">
            <label htmlFor="task-labels">Labels</label>
            <input
              id="task-labels"
              type="text"
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
              placeholder="Comma-separated labels..."
            />
          </div>
        </div>
        <div className="beads-modal-footer">
          <button className="beads-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="beads-btn-create" onClick={onCreate} disabled={!title.trim()}>Create</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
