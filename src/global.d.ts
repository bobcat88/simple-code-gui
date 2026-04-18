import type { ExtendedApi } from './renderer/api/types';

declare global {
  interface Window {
    electronAPI: ExtendedApi & Record<string, any>;
  }
}

export {};
