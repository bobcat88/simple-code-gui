import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

interface CollapsibleSectionProps {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  badge?: string | number;
  className?: string;
}

export function CollapsibleSection({ 
  title, 
  icon: Icon, 
  children, 
  isOpen, 
  onToggle, 
  badge,
  className
}: CollapsibleSectionProps) {
  return (
    <div className={cn("flex flex-col border-b border-white/5 last:border-none", className)}>
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center justify-between p-4 hover:bg-white/5 transition-all group",
          isOpen ? "bg-white/5" : "bg-transparent"
        )}
      >
        <div className="flex items-center gap-3">
          <Icon size={16} className={cn(isOpen ? "text-primary" : "text-white/40 group-hover:text-white/60")} />
          <span className={cn("text-xs font-bold uppercase tracking-widest", isOpen ? "text-white" : "text-white/30 group-hover:text-white/60")}>
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {badge !== undefined && (
            <span className="px-2 py-0.5 rounded-full bg-white/5 text-[9px] font-bold text-white/40">
              {badge}
            </span>
          )}
          <ChevronRight 
            size={14} 
            className={cn("text-white/20 group-hover:text-white/40 transition-transform duration-300", isOpen && "rotate-90 text-primary")} 
          />
        </div>
      </button>
      
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.04, 0.62, 0.23, 0.98] }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
