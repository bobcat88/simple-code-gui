import { useState, useEffect } from 'react';
import { getApi } from '../api';
import { SwarmEvent, SwarmStatus, ExtendedApi } from '../api/types';

export function useSwarmEvents() {
  const [events, setEvents] = useState<SwarmEvent[]>([]);
  const [status, setStatus] = useState<SwarmStatus>({
    activeWaveId: null,
    projectIntegrity: 100,
    retryCount: 0
  });

  useEffect(() => {
    const api = getApi() as ExtendedApi;
    if (!api || !api.onSwarmNeuralEvent) return;

    const unsubscribe = api.onSwarmNeuralEvent((event: SwarmEvent) => {
      // Add event to the list, keeping only the last 50 for performance
      setEvents((prev) => [event, ...prev].slice(0, 50));

      // If the event contains status updates, update the status
      if (event.type === 'WAVE_STATUS' && event.payload) {
        setStatus((prev) => ({
          ...prev,
          activeWaveId: event.payload.activeWaveId ?? prev.activeWaveId,
          projectIntegrity: event.payload.projectIntegrity ?? prev.projectIntegrity,
          retryCount: event.payload.retryCount ?? prev.retryCount
        }));
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { events, status };
}
