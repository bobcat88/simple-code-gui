import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearApi, getApi, initializeApi, isTauriEnvironment, setApi } from './index';

vi.mock('./tauri-backend', () => ({
  TauriBackend: class {
    readonly __type = 'tauri';
  },
}));

vi.mock('./http-backend', () => ({
  HttpBackend: class {
    readonly __type = 'http';
    constructor(public config: unknown) {}
  },
  createHttpBackend: vi.fn(),
}));

beforeEach(() => {
  clearApi();
});

afterEach(() => {
  clearApi();
  vi.unstubAllGlobals();
});

describe('isTauriEnvironment', () => {
  it('returns false when window is undefined', () => {
    vi.stubGlobal('window', undefined);
    expect(isTauriEnvironment()).toBe(false);
  });

  it('returns false when __TAURI_INTERNALS__ absent', () => {
    vi.stubGlobal('window', {});
    expect(isTauriEnvironment()).toBe(false);
  });

  it('returns true when __TAURI_INTERNALS__ present', () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} });
    expect(isTauriEnvironment()).toBe(true);
  });
});

describe('getApi / setApi / clearApi', () => {
  it('getApi returns null before init', () => {
    expect(getApi()).toBeNull();
  });

  it('setApi stores and getApi retrieves', () => {
    const stub = { __type: 'stub' } as any;
    setApi(stub);
    expect(getApi()).toBe(stub);
  });

  it('clearApi resets to null', () => {
    setApi({ __type: 'stub' } as any);
    clearApi();
    expect(getApi()).toBeNull();
  });
});

describe('initializeApi', () => {
  it('creates TauriBackend in Tauri env', () => {
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} });
    const api = initializeApi();
    expect((api as any).__type).toBe('tauri');
    expect(getApi()).toBe(api);
  });

  it('creates HttpBackend when config provided and not Tauri', () => {
    vi.stubGlobal('window', {});
    const api = initializeApi({ host: 'localhost', port: 38470, token: 'tok' });
    expect((api as any).__type).toBe('http');
    expect(getApi()).toBe(api);
  });

  it('throws when no Tauri and no config', () => {
    vi.stubGlobal('window', {});
    expect(() => initializeApi()).toThrow('unknown environment');
  });

  it('returns same instance on repeated calls from getApi', () => {
    vi.stubGlobal('window', {});
    const api = initializeApi({ host: 'h', port: 1, token: 't' });
    expect(getApi()).toBe(api);
  });
});
