import { TauriBackend } from './tauri-backend.js';
import { HttpBackend } from './http-backend.js';
import { Api } from './types.js';

export type { Api, ExtendedApi } from './api-interface';
export type { HttpBackend } from './http-backend.js';

let apiInstance: Api | null = null;

export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).__TAURI_INTERNALS__ || !!(window as any).__TAURI__;
}

export function initializeApi(config?: any): Api {
  if (isTauriEnvironment()) {
    apiInstance = new TauriBackend() as unknown as Api;
  } else if (config) {
    apiInstance = new HttpBackend(config) as unknown as Api;
  } else {
    throw new Error('unknown environment');
  }
  return apiInstance;
}

export function getApi(): Api | null {
  return apiInstance;
}

export function setApi(api: Api): void {
  apiInstance = api;
}

export function clearApi(): void {
  apiInstance = null;
}

