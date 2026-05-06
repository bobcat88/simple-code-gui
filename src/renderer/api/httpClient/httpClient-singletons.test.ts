import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, getApiClient, getElectronAPI, setHttpClient } from './index';

vi.mock('./websocket-manager', () => ({
  WebSocketManager: class {
    constructor() {}
    connect = vi.fn();
    disconnect = vi.fn();
  },
}));

beforeEach(() => {
  setHttpClient(null);
});

afterEach(() => {
  setHttpClient(null);
});

const config = { host: 'localhost', port: 38470, token: 'test-token', secure: false };

describe('createApiClient', () => {
  it('returns null when called without config and no existing client', () => {
    expect(createApiClient()).toBeNull();
  });

  it('creates and returns HttpApiClient when config provided', () => {
    const client = createApiClient(config);
    expect(client).not.toBeNull();
    expect(client).toBe(getApiClient());
  });

  it('replaces existing client on second call with config', () => {
    const first = createApiClient(config);
    const second = createApiClient({ ...config, port: 9000 });
    expect(second).not.toBe(first);
    expect(getApiClient()).toBe(second);
  });

  it('returns existing client when called without config after creation', () => {
    const created = createApiClient(config);
    expect(createApiClient()).toBe(created);
  });
});

describe('getApiClient', () => {
  it('returns null when no client set', () => {
    expect(getApiClient()).toBeNull();
  });

  it('returns client after creation', () => {
    createApiClient(config);
    expect(getApiClient()).not.toBeNull();
  });
});

describe('setHttpClient / getElectronAPI', () => {
  it('setHttpClient allows injecting a client', () => {
    const fake = { __fake: true } as any;
    setHttpClient(fake);
    expect(getApiClient()).toBe(fake);
  });

  it('setHttpClient(null) clears the client', () => {
    createApiClient(config);
    setHttpClient(null);
    expect(getApiClient()).toBeNull();
  });

  it('getElectronAPI returns the current client', () => {
    const fake = { __fake: true } as any;
    setHttpClient(fake);
    expect(getElectronAPI()).toBe(fake);
  });

  it('getElectronAPI returns null when no client', () => {
    expect(getElectronAPI()).toBeNull();
  });
});
