import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { AgentMessage } from '../../hooks/useSwarmMessages';

interface NeuralSwarmGraphProps {
  messages: AgentMessage[];
}

export const NeuralSwarmGraph: React.FC<NeuralSwarmGraphProps> = ({ messages }) => {
  // Generate random positions for nodes
  const nodes = useMemo(() => {
    // Only show the last 15 messages in the graph to avoid clutter
    const recentMessages = messages.slice(0, 15);
    return recentMessages.map((msg, i) => ({
      id: msg.id,
      x: 20 + Math.random() * 60, // 20% to 80%
      y: 20 + Math.random() * 60, // 20% to 80%
      size: 4 + Math.random() * 4,
      color: getMessageColor(msg.message_type)
    }));
  }, [messages]);

  // Generate links between consecutive nodes
  const links = useMemo(() => {
    const lines = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      lines.push({
        x1: nodes[i].x,
        y1: nodes[i].y,
        x2: nodes[i + 1].x,
        y2: nodes[i + 1].y,
        id: `link-${nodes[i].id}-${nodes[i + 1].id}`
      });
    }
    return lines;
  }, [nodes]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="linkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(99, 102, 241, 0.2)" />
            <stop offset="100%" stopColor="rgba(168, 85, 247, 0.2)" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Links */}
        {links.map((link) => (
          <motion.line
            key={link.id}
            x1={`${link.x1}%`}
            y1={`${link.y1}%`}
            x2={`${link.x2}%`}
            y2={`${link.y2}%`}
            stroke="url(#linkGradient)"
            strokeWidth="0.5"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />
        ))}

        {/* Nodes */}
        {nodes.map((node, i) => (
          <motion.circle
            key={node.id}
            cx={`${node.x}%`}
            cy={`${node.y}%`}
            r={node.size / 2}
            fill={node.color}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: 1,
              filter: ["none", "url(#glow)", "none"]
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity, 
              delay: i * 0.2,
              scale: { duration: 2 + Math.random() * 2, repeat: Infinity }
            }}
          />
        ))}

        {/* Pulsing connections */}
        {links.length > 0 && (
          <motion.circle
            r="0.8"
            fill="#fff"
            initial={{ opacity: 0 }}
            animate={{ 
              cx: links.map(l => [`${l.x1}%`, `${l.x2}%`]).flat(),
              cy: links.map(l => [`${l.y1}%`, `${l.y2}%`]).flat(),
              opacity: [0, 1, 0]
            }}
            transition={{ 
              duration: 10, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            style={{ filter: 'blur(1px)' }}
          />
        )}
      </svg>

      {/* Backdrop patterns */}
      <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
    </div>
  );
};

function getMessageColor(type: string): string {
  switch (type) {
    case 'finding': return '#10b981'; // emerald
    case 'request': return '#3b82f6'; // blue
    case 'warning': return '#f59e0b'; // amber
    case 'alert': return '#ef4444'; // red
    case 'simulation': return '#a855f7'; // purple
    default: return '#71717a'; // zinc
  }
}
