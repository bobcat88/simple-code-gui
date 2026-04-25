import { useState, useEffect, useCallback } from 'react';
import { tauriIpc } from '../lib/tauri-ipc';

export interface AgentMessage {
  id: string;
  timestamp: string;
  from_agent: string;
  to_agent?: string;
  message_type: 'finding' | 'request' | 'warning' | 'alert';
  content: string;
  metadata?: any;
}

export function useSwarmMessages(limit = 50) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await tauriIpc.getAgentMessages(limit);
      setMessages(data);
    } catch (err) {
      console.error('Failed to fetch swarm messages:', err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchMessages();

    const pMessage = tauriIpc.onAgentMessage((message) => {
      setMessages((prev) => [message, ...prev].slice(0, limit));
    });

    return () => {
      pMessage.then((unsub) => unsub());
    };
  }, [fetchMessages, limit]);

  return { messages, loading, refresh: fetchMessages };
}
