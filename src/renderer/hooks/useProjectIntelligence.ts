import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import type {
  ExtendedApi,
  ProjectCapabilityScan,
  ProjectIntelligence,
  VectorIndexStatus,
} from '../api/types';

interface ProjectIntelligenceState {
  intelligence: ProjectIntelligence | null;
  capabilityScan: ProjectCapabilityScan | null;
  vectorStatus: VectorIndexStatus | null;
}

const EMPTY_PROJECT_INTELLIGENCE: ProjectIntelligenceState = {
  intelligence: null,
  capabilityScan: null,
  vectorStatus: null,
};

export function useProjectIntelligence(
  api: ExtendedApi,
  projectPath: string | null
) {
  const query = useQuery<ProjectIntelligenceState, Error>({
    queryKey: ['project-intelligence', projectPath],
    enabled: Boolean(projectPath),
    queryFn: async () => {
      if (!projectPath) return EMPTY_PROJECT_INTELLIGENCE;

      const [intelligence, capabilityScan, vectorStatus] = await Promise.all([
        api.scanProjectIntelligence(projectPath),
        api.projectScan(projectPath, {
          includeCliHealth: true,
          includeGitHealth: true,
        }),
        api.vectorGetStatus(),
      ]);

      return { intelligence, capabilityScan, vectorStatus };
    },
    refetchInterval: 30000,
    retry: 1,
    throwOnError: false,
  });

  const triggerDeepScan = useCallback(async () => {
    if (!projectPath) return;
    try {
      await api.projectScanAsync(projectPath);
    } catch (err) {
      console.error('Failed to trigger deep scan:', err);
    }
  }, [api, projectPath]);

  const syncGlobalKnowledge = useCallback(async () => {
    try {
      await api.vectorIndexKnowledge();
      await query.refetch();
    } catch (err) {
      console.error('Failed to sync global knowledge:', err);
    }
  }, [api, query]);

  const reindexProject = useCallback(async () => {
    if (!projectPath) return;
    try {
      await api.vectorIndexProject(projectPath);
      await query.refetch();
    } catch (err) {
      console.error('Failed to reindex project:', err);
    }
  }, [api, projectPath, query]);

  const data = query.data ?? EMPTY_PROJECT_INTELLIGENCE;

  return {
    intelligence: data.intelligence,
    capabilityScan: data.capabilityScan,
    vectorStatus: data.vectorStatus,
    loading: query.isLoading,
    error: query.error ? query.error.message : null,
    refresh: query.refetch,
    triggerDeepScan,
    syncGlobalKnowledge,
    reindexProject,
  };
}
