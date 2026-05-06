import { useQuery } from '@tanstack/react-query';
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
    diagnostics: Array<{
      level: string;
      message: string;
      suggestion?: string;
      code?: string;
    }>;
  }>;
  installed_extensions: InstalledExtension[];
}

export function useHealthStatus() {
  const query = useQuery<HealthStatus, Error>({
    queryKey: ['health-status'],
    queryFn: async () => await tauriIpc.healthGetStatus(),
    refetchInterval: 2000,
    retry: 1,
    throwOnError: false,
  });

  return {
    status: query.data ?? null,
    loading: query.isLoading,
    refresh: async () => {
      try {
        await query.refetch();
      } catch (err) {
        console.error('Failed to fetch health status:', err);
      }
    },
  };
}
