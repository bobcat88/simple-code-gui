import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Bug, 
  ChevronRight, 
  FileText, 
  ExternalLink,
  Search,
  ShieldAlert
} from 'lucide-react';
import { useApi } from '../../contexts/ApiContext';
import { cn } from '../../lib/utils';
import type { SwarmKnowledge } from '../../api/types';

export function ForensicReport() {
  const { api } = useApi();
  const [reports, setReports] = useState<SwarmKnowledge[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, [api]);

  const fetchReports = async () => {
    if (!api?.gsdSwarmQueryMemory) return;
    setIsLoading(true);
    try {
      // Query specifically for failures/forensics
      const results = await api.gsdSwarmQueryMemory('', 'failure', 5);
      setReports(results);
    } catch (e) {
      console.error('Failed to fetch forensic reports', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (reports.length === 0 && !isLoading) return null;

  return (
    <div className="flex flex-col gap-2 w-80 pointer-events-auto">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-widest font-bold text-red-400 flex items-center gap-1.5">
          <ShieldAlert size={12} />
          Forensic Analysis
        </span>
        <button 
          onClick={fetchReports}
          className="p-1 hover:bg-white/5 rounded text-white/40 hover:text-white/60 transition-colors"
        >
          <Search size={10} />
        </button>
      </div>

      {isLoading ? (
        <div className="h-20 rounded-xl bg-white/5 animate-pulse border border-white/5" />
      ) : (
        reports.map((report) => (
          <motion.div
            key={report.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative overflow-hidden rounded-xl bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 transition-all p-3"
          >
            <div className="flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-red-500/20 text-red-400">
                <Bug size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <h5 className="text-xs font-bold text-white/90 mb-0.5 truncate">
                  {report.pattern_key}
                </h5>
                <p className="text-[10px] text-white/50 line-clamp-2 leading-relaxed">
                  {report.content}
                </p>
              </div>
              <ChevronRight size={14} className="text-white/20 group-hover:text-white/40 group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* Micro-glow effect */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 blur-[40px] pointer-events-none group-hover:bg-red-500/20 transition-all" />
          </motion.div>
        ))
      )}
    </div>
  );
}
