import React, { useState, useEffect } from 'react'
import { Brain, Cpu, RefreshCw, Search, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ExtendedApi, VectorIndexStatus, OpenTab } from '../../api/types'

interface VectorIndexSectionProps {
  vectorStatus: VectorIndexStatus | null
  api: ExtendedApi
  activeTab?: OpenTab | null
  onOpenSearch: () => void
  onReindex: () => void
  onSyncMemory: () => void
}

export function VectorIndexSection({
  vectorStatus,
  api,
  activeTab,
  onOpenSearch,
  onReindex,
  onSyncMemory,
}: VectorIndexSectionProps) {
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)

  useEffect(() => {
    if (!activeTab?.projectPath) {
      setSuggestions([])
      return
    }

    const fetchSuggestions = async () => {
      setIsLoadingSuggestions(true)
      try {
        const results = await api.vectorSearch(activeTab.projectPath, 3)
        setSuggestions(results)
      } catch (err) {
        console.error('Failed to fetch neural suggestions:', err)
      } finally {
        setIsLoadingSuggestions(false)
      }
    }

    fetchSuggestions()
  }, [activeTab?.projectPath, api])

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-white/40">Cognitive Context</h3>
        <div className="flex items-center gap-1.5">
          <Brain size={12} className="text-purple-400" />
          <span className="text-[10px] text-purple-400/80 font-medium">Transwarp</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-white/5 border border-white/5 rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu size={14} className="text-purple-400" />
              <span className="text-xs text-white/90 font-medium">Vector Index</span>
            </div>
            {vectorStatus?.isIndexing && (
              <span className="flex items-center gap-1 text-[9px] text-purple-400 animate-pulse">
                <RefreshCw size={10} className="animate-spin" />
                Indexing...
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-white/40">
              <span>Progress</span>
              <span>{vectorStatus?.indexedChunks ?? 0} / {vectorStatus?.totalChunks ?? 0}</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)] transition-all duration-500"
                style={{
                  width: `${vectorStatus?.totalChunks ? (vectorStatus.indexedChunks / vectorStatus.totalChunks) * 100 : 0}%`
                }}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onOpenSearch}
              className="flex-1 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <Search size={12} />
              Semantic Search
            </button>
            <button
              onClick={onReindex}
              disabled={vectorStatus?.isIndexing}
              className="px-2 py-1.5 bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 rounded-lg text-[10px] transition-all disabled:opacity-50"
              title="Re-index Project"
            >
              <RefreshCw size={12} className={cn(vectorStatus?.isIndexing && "animate-spin")} />
            </button>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/10 flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <Brain size={14} className="text-purple-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-medium text-purple-400">Long-term Memory</div>
              <p className="text-[10px] text-white/40 leading-normal">
                Vector index enables semantic codebase understanding and global knowledge recall.
              </p>
            </div>
          </div>
          <button
            onClick={onSyncMemory}
            className="w-full py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 rounded-lg text-[10px] font-medium transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw size={12} className={cn(vectorStatus?.isIndexing && "animate-spin")} />
            Sync Global Knowledge (Borg)
          </button>
        </div>

        {activeTab && (
          <div className="p-3 bg-white/5 border border-white/5 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-pink-400" />
              <span className="text-xs text-white/90 font-medium">Neural Suggestions</span>
            </div>

            {isLoadingSuggestions ? (
              <div className="space-y-2 py-1">
                <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
                <div className="h-10 bg-white/5 rounded-lg animate-pulse" />
              </div>
            ) : suggestions.length > 0 ? (
              <div className="space-y-1.5">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className="w-full p-2 text-left bg-white/5 hover:bg-white/10 rounded-lg border border-transparent hover:border-white/10 transition-all group"
                  >
                    <div className="text-[10px] text-white/80 font-medium truncate group-hover:text-pink-300 transition-colors">
                      {s.text.length > 40 ? s.text.substring(0, 40) + '...' : s.text}
                    </div>
                    <div className="text-[9px] text-white/25 truncate mt-0.5">
                      {s.metadata?.file_path || 'Borg Knowledge'}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-[10px] text-white/20 italic text-center py-2">
                No related context found.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
