import { useState, useEffect, useCallback } from 'react';
import { tauriIpc } from '../lib/tauri-ipc';

export interface ActivityEvent {
  id?: number;
  event_type: string;
  source: string;
  message: string;
  metadata?: string;
  timestamp: string;
}

export function useActivityLog(limit = 50) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const recent = await tauriIpc.activityGetRecent(limit);
      setEvents(recent);
    } catch (err) {
      console.error('Failed to fetch activity log:', err);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchEvents();

    let unlisten: (() => void) | undefined;
    
    const setupListener = async () => {
      unlisten = await tauriIpc.onActivityEvent((event) => {
        setEvents((prev) => [event, ...prev].slice(0, limit));
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [fetchEvents, limit]);

  return { events, loading, refresh: fetchEvents };
}
