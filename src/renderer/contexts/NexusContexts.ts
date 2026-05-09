import { createContext, useContext } from 'react';
import type { Api, ApiContext as ApiContextType } from '../api/types';

/**
 * NEXUS CORE CONTEXTS
 * 
 * This file is a LEAF NODE in the dependency graph.
 * It MUST NOT import from any other renderer files (except types).
 * This guarantees that Context objects and Hooks are initialized 
 * before any other module executes.
 */

// 1. API CONTEXT
export const ApiContext = createContext<ApiContextType | null>(null);
export function useApi(): Api {
  const context = useContext(ApiContext);
  if (!context) throw new Error('useApi must be used within an ApiProvider');
  return context.api;
}
export function useApiContext(): ApiContextType {
  const context = useContext(ApiContext);
  if (!context) throw new Error('useApiContext must be used within an ApiProvider');
  return context;
}

// 2. VOICE CONTEXT
// Internal type copy to avoid importing from VoiceContext/types which might have dependencies
export interface VoiceContextValue {
  voiceOutputEnabled: boolean;
  setVoiceOutputEnabled: (enabled: boolean) => void;
  speakText: (text: string) => Promise<void>;
  stopSpeaking: () => void;
  isSpeaking: boolean;
  volume: number;
  setVolume: (volume: number) => void;
  speed: number;
  setSpeed: (speed: number) => void;
  skipOnNew: boolean;
  setSkipOnNew: (skip: boolean) => void;
  setProjectVoice: (settings: { ttsVoice: string; ttsEngine: string } | null) => void;
  isRecording: boolean;
  isModelLoading: boolean;
  isModelLoaded: boolean;
  modelLoadProgress: number;
  modelLoadStatus: string;
  currentTranscription: string;
  whisperModel: string;
  setWhisperModel: (model: any) => void;
  audioLevel: number;
  silenceThreshold: number;
  setSilenceThreshold: (threshold: number) => void;
  startRecording: (onTranscription: (text: string) => void) => Promise<void>;
  stopRecording: () => void;
  pushToTalkEnabled: boolean;
  setPushToTalkEnabled: (enabled: boolean) => void;
  autoListenEnabled: boolean;
  setAutoListenEnabled: (enabled: boolean) => void;
  registerTranscriptionHandler: (id: string, handler: (text: string) => void) => void;
  unregisterTranscriptionHandler: (id: string) => void;
}

export const VoiceContext = createContext<VoiceContextValue | null>(null);
export function useVoice(): VoiceContextValue {
  const context = useContext(VoiceContext);
  if (!context) throw new Error('useVoice must be used within a VoiceProvider');
  return context;
}

// 3. MODAL CONTEXT
export interface ModalContextValue {
  settingsOpen: boolean;
  projectWizardOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  openProjectWizard: () => void;
  closeProjectWizard: () => void;
}
export const ModalContext = createContext<ModalContextValue | null>(null);
export function useModals(): ModalContextValue {
  const context = useContext(ModalContext);
  if (!context) throw new Error('useModals must be used within a ModalProvider');
  return context;
}

// 4. DIALOG CONTEXT
export interface DialogContextValue {
  showError: (message: string) => void;
  showConfirm: (message: string) => Promise<boolean>;
  showInfo: (message: string) => void;
}
export const DialogContext = createContext<DialogContextValue | null>(null);
export function useDialog(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) throw new Error('useDialog must be used inside DialogProvider');
  return context;
}
