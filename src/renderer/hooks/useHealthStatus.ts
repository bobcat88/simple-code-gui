import { useState, useEffect, useCallback } from 'react';
import { tauriIpc } from '../lib/tauri-ipc';
import type { InstalledExtension } from './useExtensions';

export interface HealthStatus {
  cpu_usage: number;
  memory_usage: number;
  total_memory: number;
  threads: number;
  status: string;
  services: Array<{
    id: string;
    name: string;
    status: string;
    detail: string;
  }>;
  installed_extensions: InstalledExtension[];
}

export function useHealthStatus() {
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await tauriIpc.healthGetStatus();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch health status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 2000); // Update every 2s
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return { status, loading, refresh: fetchStatus };
}
