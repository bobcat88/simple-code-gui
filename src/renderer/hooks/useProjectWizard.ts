import { useState, useCallback } from 'react';
import { Api } from '../api';
import { ProjectCapabilityScan, InitializationProposal, DetectedMarker, CapabilityScanResult, ScanWarning, ScanBlocker } from '../api/types';

export type WizardStep = 'path' | 'scanning' | 'detection' | 'proposal' | 'applying' | 'finished' | 'error';

export function useProjectWizard(api: Api) {
  const [step, setStep] = useState<WizardStep>('path');
  const [path, setPath] = useState<string>('');
  const [scan, setScan] = useState<ProjectCapabilityScan | null>(null);
  const [proposal, setProposal] = useState<InitializationProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [appliedFiles, setAppliedFiles] = useState<string[]>([]);

  const startScan = useCallback(async (targetPath: string) => {
    setLoading(true);
    setError(null);
    setStep('scanning');
    try {
      const result = await api.projectScan(targetPath);
      setScan(result);
      setPath(targetPath);
      setStep('detection');
    } catch (err: any) {
      setError(err.message || String(err));
      setStep('error');
    } finally {
      setLoading(false);
    }
  }, [api]);

  const generateProposal = useCallback(async (preset: string, name: string, backend: string, enabledCapabilities?: string[]) => {
    if (!scan) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.projectGenerateProposal(scan, preset, name, backend, enabledCapabilities);
      setProposal(result);
      setStep('proposal');
    } catch (err: any) {
      setError(err.message || String(err));
      setStep('error');
    } finally {
      setLoading(false);
    }
  }, [api, scan]);

  const applyProposal = useCallback(async () => {
    if (!proposal) return;
    setLoading(true);
    setError(null);
    setStep('applying');
    try {
      const files = await api.projectApplyProposal(proposal);
      setAppliedFiles(files);
      setStep('finished');
    } catch (err: any) {
      setError(err.message || String(err));
      setStep('error');
    } finally {
      setLoading(false);
    }
  }, [api, proposal]);

  const reset = useCallback(() => {
    setStep('path');
    setPath('');
    setScan(null);
    setProposal(null);
    setError(null);
    setAppliedFiles([]);
  }, []);

  return {
    step,
    setStep,
    path,
    setPath,
    scan,
    proposal,
    error,
    loading,
    appliedFiles,
    startScan,
    generateProposal,
    applyProposal,
    reset
  };
}
