import React from 'react'
import { 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Edit3, 
  FileText, 
  Terminal as TerminalIcon, 
  Settings,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { ApprovalRequest } from './types'

function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}

interface ApprovalPanelProps {
  approvals: ApprovalRequest[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onModify?: (id: string) => void
}

export function ApprovalPanel({ 
  approvals, 
  onApprove, 
  onReject, 
  onModify 
}: ApprovalPanelProps) {
  if (approvals.length === 0) return null

  return (
    <div className="approvals-section animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="section-header">
        <ShieldAlert size={18} className="text-indigo-400" />
        <h3>Pending Approvals ({approvals.length})</h3>
      </div>
      
      <div className="approvals-list">
        {approvals.map((approval) => (
          <ApprovalCard 
            key={approval.id} 
            approval={approval}
            onApprove={onApprove}
            onReject={onReject}
            onModify={onModify}
          />
        ))}
      </div>
    </div>
  )
}

interface ApprovalCardProps {
  approval: ApprovalRequest
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onModify?: (id: string) => void
}

function ApprovalCard({ approval, onApprove, onReject, onModify }: ApprovalCardProps) {
  const [expanded, setExpanded] = React.useState(true)
  const { metadata, agentName, message, timestamp } = approval
  const risk = metadata?.risk || 'medium'
  
  return (
    <div className={cn("approval-card", risk)}>
      <div className="approval-card-header" onClick={() => setExpanded(!expanded)}>
        <div className="approval-type-icon">
          {metadata?.type === 'file_change' && <FileText size={16} />}
          {metadata?.type === 'command' && <TerminalIcon size={16} />}
          {metadata?.type === 'config_change' && <Settings size={16} />}
          {!metadata?.type && <ShieldAlert size={16} />}
        </div>
        
        <div className="approval-info">
          <div className="approval-meta">
            <span className="agent-name">{agentName}</span>
            <span className="timestamp">{new Date(timestamp).toLocaleTimeString()}</span>
          </div>
          <p className="approval-message">{message}</p>
        </div>

        <div className="approval-risk-badge">
          <AlertTriangle size={12} />
          <span>{risk.toUpperCase()} RISK</span>
        </div>

        <button className="expand-button">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="approval-card-content animate-in zoom-in-95 duration-200">
          {metadata?.diff && (
            <div className="diff-preview">
              <div className="diff-header">Diff Preview</div>
              <pre className="diff-content">
                {metadata.diff.split('\n').map((line, i) => (
                  <div key={i} className={cn(
                    "diff-line",
                    line.startsWith('+') && "added",
                    line.startsWith('-') && "removed"
                  )}>
                    {line}
                  </div>
                ))}
              </pre>
            </div>
          )}

          {metadata?.command && (
            <div className="command-preview">
              <div className="command-header">Command</div>
              <code>{metadata.command}</code>
            </div>
          )}

          {metadata?.riskReason && (
            <div className="risk-reason">
              <AlertTriangle size={14} className="text-amber-500" />
              <span>{metadata.riskReason}</span>
            </div>
          )}

          {metadata?.impact && metadata.impact.length > 0 && (
            <div className="impact-list">
              <div className="impact-header">Potential Impact</div>
              <ul>
                {metadata.impact.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="approval-actions">
            <button 
              className="btn-approve"
              onClick={(e) => { e.stopPropagation(); onApprove(approval.id); }}
            >
              <CheckCircle2 size={14} />
              Approve
            </button>
            <button 
              className="btn-reject"
              onClick={(e) => { e.stopPropagation(); onReject(approval.id); }}
            >
              <XCircle size={14} />
              Reject
            </button>
            {onModify && (
              <button 
                className="btn-modify"
                onClick={(e) => { e.stopPropagation(); onModify(approval.id); }}
              >
                <Edit3 size={14} />
                Modify
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
