import React, { useState, useEffect, useRef } from 'react'
import { Search, FileCode, Command, X, Brain, ExternalLink } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { VectorSearchResult, Api } from '../../api/types'

interface CognitiveSearchModalProps {
  isOpen: boolean
  onClose: () => void
  api: Api
  projectPath: string | null
}

export function CognitiveSearchModal({ 
  isOpen, 
  onClose, 
  api,
  projectPath 
}: CognitiveSearchModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<VectorSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setResults([])
      setSelectedIndex(0)
      const timer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  // Semantic search debounced
  useEffect(() => {
    if (!query.trim() || !projectPath) {
      setResults([])
      return
    }

    const handler = setTimeout(async () => {
      setIsSearching(true)
      try {
        const searchResults = api.vectorSearch ? await api.vectorSearch(query, 10, projectPath) : []
        // Filter by project path if needed (though backend currently search all or you can filter here)
        setResults(searchResults)
      } catch (err) {
        console.error('Semantic search failed:', err)
      } finally {
        setIsSearching(false)
      }
    }, 400)

    return () => clearTimeout(handler)
  }, [query, api, projectPath])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (results.length > 0 ? (prev + 1) % results.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIndex]) {
        handleOpenResult(results[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const handleOpenResult = (result: VectorSearchResult) => {
    // Open file at line if possible
    api.openFile?.(result.chunk.filePath)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div 
        ref={containerRef} 
        className="w-full max-w-2xl bg-[#0a0a0c]/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center px-5 py-4 border-b border-white/10 gap-4">
          <div className="relative">
            <Brain size={22} className={cn("text-purple-400 transition-all", isSearching && "animate-pulse scale-110")} />
            {isSearching && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-purple-500 rounded-full animate-ping" />
            )}
          </div>
          <input 
            ref={inputRef}
            type="text" 
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search semantics, logic, or concepts..."
            className="flex-1 bg-transparent border-none text-xl outline-none text-white placeholder:text-white/20"
          />
          <div className="flex items-center gap-2">
            <div className="px-2 py-1 rounded bg-purple-500/20 border border-purple-500/30 text-[10px] font-bold text-purple-300 uppercase tracking-wider">
              Transwarp
            </div>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-white/40 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto py-2 custom-scrollbar min-h-[300px]">
          {!query ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-10">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-400 mb-4">
                <Brain size={32} />
              </div>
              <h3 className="text-white/90 font-medium mb-1">Cognitive Search</h3>
              <p className="text-white/30 text-sm max-w-[280px]">
                Ask questions like "where is the auth logic?" or "how do I handle file uploads?"
              </p>
            </div>
          ) : isSearching && results.length === 0 ? (
            <div className="px-6 py-12 text-center flex flex-col items-center">
              <div className="w-10 h-10 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-4" />
              <div className="text-white/40 italic">Exploring project context...</div>
            </div>
          ) : results.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-white/40 italic mb-2">No semantic matches found for "{query}"</div>
              <div className="text-[10px] text-white/20 uppercase tracking-widest">Try describing the functionality you're looking for</div>
            </div>
          ) : (
            <div className="px-2 space-y-1">
              <div className="px-4 py-2 text-[10px] font-bold text-white/20 uppercase tracking-widest">Top Matches</div>
              {results.map((result, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "px-4 py-3 cursor-pointer flex flex-col gap-2 transition-all duration-200 rounded-xl",
                    idx === selectedIndex ? "bg-white/10 border border-white/10 shadow-lg scale-[1.01]" : "bg-transparent border border-transparent hover:bg-white/5"
                  )}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => handleOpenResult(result)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCode size={14} className="text-purple-400 shrink-0" />
                      <span className="text-[13px] font-medium text-white/90 truncate">
                        {result.chunk.symbolName || result.chunk.filePath.split('/').pop()}
                      </span>
                      <span className="text-[10px] text-white/30 truncate font-mono">
                        {result.chunk.filePath.replace(projectPath || '', '')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-[10px] font-bold text-purple-400/60">
                        {Math.round(result.score * 100)}% Match
                      </div>
                      <ExternalLink size={12} className="text-white/20" />
                    </div>
                  </div>
                  
                  <div className="relative">
                    <pre className="text-[11px] text-white/50 font-mono line-clamp-3 leading-relaxed bg-black/20 p-2 rounded-lg border border-white/5 whitespace-pre-wrap break-all">
                      {result.chunk.content}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="px-5 py-3 border-t border-white/5 flex items-center justify-between text-[10px] text-white/20 font-medium bg-black/20">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded shadow-sm text-[9px]">↑↓</kbd> 
              Navigate
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded shadow-sm text-[9px]">↵</kbd> 
              Open File
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-purple-400/50">
            <Brain size={12} />
            <span>Powered by Transwarp Nexus</span>
          </div>
        </div>
      </div>
    </div>
  )
}
