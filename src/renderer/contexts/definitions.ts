import { createContext, useContext } from 'react';
import type { Api, ApiContext as ApiContextType } from '../api/types';
import type { VoiceContextValue } from './VoiceContext/types';

/**
 * CORE CONTEXT DEFINITIONS & HOOKS
 * 
 * Centralizing both Contexts AND Hooks here is the absolute "nuclear option"
 * to break circular dependencies. This ensures that the context and its
 * accessors are always ready at the same time.
 */

// API Context
export const ApiContext = createContext<ApiContextType | null>(null);

export function useApi(): Api {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return context.api;
}

export function useApiContext(): ApiContextType {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApiContext must be used within an ApiProvider');
  }
  return context;
}

// Voice Context
export const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoice(): VoiceContextValue {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
}

// Modal Context
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
  if (!context) {
    throw new Error('useModals must be used within a ModalProvider');
  }
  return context;
}

// Dialog Context
export interface DialogContextValue {
  showError: (message: string) => void;
  showConfirm: (message: string) => Promise<boolean>;
  showInfo: (message: string) => void;
}
export const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}
