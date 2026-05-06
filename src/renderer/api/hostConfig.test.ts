import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildApiUrl,
  buildBaseUrl,
  buildWsUrl,
  clearHostConfig,
  generateConnectionUrl,
  getDefaultConfig,
  getHostConfig,
  hasHostConfig,
  parseConnectionUrl,
  saveHostConfig,
  validateHostConfig,
} from './hostConfig';

const validConfig = { host: 'localhost', port: 38470, token: 'tok-abcdefgh', secure: false };

const storageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((k: string) => store[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { store[k] = v; }),
    removeItem: vi.fn((k: string) => { delete store[k]; }),
    clear: () => { store = {}; },
  };
})();

beforeEach(() => {
  vi.stubGlobal('localStorage', storageMock);
  storageMock.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getHostConfig', () => {
  it('returns null when nothing stored', () => {
    expect(getHostConfig()).toBeNull();
  });

  it('returns parsed config when valid JSON stored', () => {
    storageMock.setItem('claude-terminal-host-config', JSON.stringify(validConfig));
    expect(getHostConfig()).toEqual(validConfig);
  });

  it('returns null when stored JSON is missing required fields', () => {
    storageMock.setItem('claude-terminal-host-config', JSON.stringify({ host: 'x' }));
    expect(getHostConfig()).toBeNull();
  });

  it('returns null on malformed JSON', () => {
    storageMock.setItem('claude-terminal-host-config', 'not-json');
    expect(getHostConfig()).toBeNull();
  });
});

describe('saveHostConfig', () => {
  it('stores valid config', () => {
    saveHostConfig(validConfig);
    expect(storageMock.setItem).toHaveBeenCalledWith(
      'claude-terminal-host-config',
      JSON.stringify(validConfig)
    );
  });

  it('throws when required fields missing', () => {
    expect(() => saveHostConfig({ host: '', port: 0, token: '' })).toThrow();
  });
});

describe('clearHostConfig', () => {
  it('removes stored key', () => {
    clearHostConfig();
    expect(storageMock.removeItem).toHaveBeenCalledWith('claude-terminal-host-config');
  });
});

describe('hasHostConfig', () => {
  it('returns false when nothing stored', () => {
    expect(hasHostConfig()).toBe(false);
  });

  it('returns true when valid config stored', () => {
    storageMock.setItem('claude-terminal-host-config', JSON.stringify(validConfig));
    expect(hasHostConfig()).toBe(true);
  });
});

describe('getDefaultConfig', () => {
  it('returns object without token', () => {
    const d = getDefaultConfig();
    expect(d.host).toBe('localhost');
    expect(d.port).toBe(38470);
    expect('token' in d).toBe(false);
  });
});

describe('buildBaseUrl', () => {
  it('builds http URL', () => {
    expect(buildBaseUrl(validConfig)).toBe('http://localhost:38470');
  });

  it('builds https URL for secure config', () => {
    expect(buildBaseUrl({ ...validConfig, secure: true })).toBe('https://localhost:38470');
  });

  it('throws on invalid port', () => {
    expect(() => buildBaseUrl({ ...validConfig, port: 99999 })).toThrow('Invalid port');
  });
});

describe('buildWsUrl', () => {
  it('builds ws URL', () => {
    expect(buildWsUrl(validConfig)).toBe('ws://localhost:38470/ws');
  });

  it('builds wss URL for secure', () => {
    expect(buildWsUrl({ ...validConfig, secure: true })).toBe('wss://localhost:38470/ws');
  });

  it('throws on invalid port', () => {
    expect(() => buildWsUrl({ ...validConfig, port: 0 })).toThrow('Invalid port');
  });
});

describe('buildApiUrl', () => {
  it('builds full API URL with leading slash', () => {
    expect(buildApiUrl(validConfig, '/sessions')).toBe('http://localhost:38470/api/sessions');
  });

  it('adds leading slash when endpoint lacks it', () => {
    expect(buildApiUrl(validConfig, 'sessions')).toBe('http://localhost:38470/api/sessions');
  });
});

describe('validateHostConfig', () => {
  it('passes valid config', () => {
    expect(validateHostConfig(validConfig)).toEqual({ valid: true, errors: [] });
  });

  it('fails on missing host', () => {
    const { errors } = validateHostConfig({ port: 3000, token: 'abcdefgh' });
    expect(errors.some(e => e.includes('Host'))).toBe(true);
  });

  it('fails on invalid host characters', () => {
    const { errors } = validateHostConfig({ host: 'bad host!', port: 3000, token: 'abcdefgh' });
    expect(errors.some(e => e.includes('invalid characters'))).toBe(true);
  });

  it('fails on port out of range', () => {
    const { errors } = validateHostConfig({ host: 'h', port: 70000, token: 'abcdefgh' });
    expect(errors.some(e => e.includes('65535'))).toBe(true);
  });

  it('fails on short token', () => {
    const { errors } = validateHostConfig({ host: 'h', port: 3000, token: 'short' });
    expect(errors.some(e => e.includes('8 characters'))).toBe(true);
  });
});

describe('parseConnectionUrl', () => {
  it('parses http URL with token param', () => {
    const result = parseConnectionUrl('http://192.168.1.5:38470?token=mytoken123');
    expect(result).toEqual({ host: '192.168.1.5', port: 38470, token: 'mytoken123', secure: false });
  });

  it('parses https URL as secure', () => {
    const result = parseConnectionUrl('https://myhost.com:443?token=tok');
    expect(result?.secure).toBe(true);
  });

  it('returns null for malformed URL', () => {
    expect(parseConnectionUrl('not a url')).toBeNull();
  });

  it('returns null when token missing', () => {
    expect(parseConnectionUrl('http://localhost:38470')).toBeNull();
  });
});

describe('generateConnectionUrl', () => {
  it('produces correct URL with encoded token', () => {
    const url = generateConnectionUrl({ host: 'myhost', port: 9000, token: 'tok abc', secure: false });
    expect(url).toBe('http://myhost:9000?token=tok%20abc');
  });

  it('uses https for secure config', () => {
    const url = generateConnectionUrl({ ...validConfig, secure: true });
    expect(url.startsWith('https://')).toBe(true);
  });
});
