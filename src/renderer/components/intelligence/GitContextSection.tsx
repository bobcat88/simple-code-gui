import React from 'react'
import { GitBranch, AlertTriangle, History } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ProjectIntelligence } from '../../api/types'

interface GitContextSectionProps {
  git: ProjectIntelligence['git']
}

export function GitContextSection({ git }: GitContextSectionProps) {
  return (
    <section>
      <h3 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-3">Git Context</h3>
      {git ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <GitBranch size={14} className="text-indigo-400" />
            <span className="font-mono text-white/80">{git.branch}</span>
            {git.isDirty && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[9px] font-bold uppercase tracking-tighter">
                Modified
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 bg-white/5 rounded-codex p-3 border border-white/5">
            <div className="space-y-1">
              <div className="text-[10px] text-white/40 uppercase font-bold">Uncommitted</div>
              <div className="text-lg font-semibold tabular-nums">{git.uncommittedCount}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] text-white/40 uppercase font-bold">Sync Status</div>
              <div className="text-xs flex items-center gap-2">
                <span className="text-emerald-400">↑{git.ahead}</span>
                <span className="text-rose-400">↓{git.behind}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] text-white/40 uppercase font-bold px-1 flex items-center gap-1">
              <History size={10} /> Recent Changes
            </div>
            {git.recentCommits.map((commit: any, i: number) => (
              <div key={i} className="text-xs leading-relaxed border-l-2 border-white/10 pl-3 py-1 group hover:border-indigo-500/50 transition-colors">
                <div className="text-white/80 line-clamp-1 group-hover:text-white">{commit.message}</div>
                <div className="text-white/30 text-[9px] mt-0.5">{commit.author} • {new Date(commit.date).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-rose-400/60 bg-rose-500/5 p-3 rounded-lg border border-rose-500/10">
          <AlertTriangle size={14} />
          <span>Git repository not detected or accessible</span>
        </div>
      )}
    </section>
  )
}
