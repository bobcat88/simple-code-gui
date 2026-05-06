import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostConfig } from '../hostConfig';
import { del, get, patch, post, put } from './http-helpers';

const config: HostConfig = {
  host: 'localhost',
  port: 38470,
  token: 'test-token-abc',
  secure: false,
};

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function makeResponse(data: unknown, success = true, status = 200) {
  return Promise.resolve({
    status,
    json: () => Promise.resolve({ success, data, error: success ? undefined : 'bad request' }),
  } as Response);
}

describe('get', () => {
  it('calls fetch with GET and Authorization header', async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ result: 'ok' }));
    const result = await get<{ result: string }>(config, '/sessions');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:38470/api/sessions',
      expect.objectContaining({ method: 'GET', headers: expect.objectContaining({ Authorization: 'Bearer test-token-abc' }) })
    );
    expect(result).toEqual({ result: 'ok' });
  });

  it('prepends slash to endpoint if missing', async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}));
    await get(config, 'sessions');
    expect(mockFetch).toHaveBeenCalledWith('http://localhost:38470/api/sessions', expect.anything());
  });

  it('throws when success is false', async () => {
    mockFetch.mockReturnValueOnce(makeResponse(null, false, 400));
    await expect(get(config, '/fail')).rejects.toThrow('bad request');
  });
});

describe('post', () => {
  it('sends JSON body', async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ id: '123' }));
    const result = await post<{ id: string }>(config, '/tasks', { title: 'Test' });
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('POST');
    expect(opts.body).toBe(JSON.stringify({ title: 'Test' }));
    expect(result).toEqual({ id: '123' });
  });

  it('works without body', async () => {
    mockFetch.mockReturnValueOnce(makeResponse(null));
    await post(config, '/ping');
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.body).toBeUndefined();
  });
});

describe('put', () => {
  it('sends PUT with body', async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ updated: true }));
    await put(config, '/tasks/1', { priority: 5 });
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('PUT');
    expect(opts.body).toBe(JSON.stringify({ priority: 5 }));
  });
});

describe('patch', () => {
  it('sends PATCH', async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}));
    await patch(config, '/tasks/1', { status: 'done' });
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('PATCH');
  });
});

describe('del', () => {
  it('sends DELETE with no body', async () => {
    mockFetch.mockReturnValueOnce(makeResponse(null));
    await del(config, '/tasks/1');
    const [, opts] = mockFetch.mock.calls[0];
    expect(opts.method).toBe('DELETE');
    expect(opts.body).toBeUndefined();
  });
});

describe('secure config', () => {
  it('uses https for secure config', async () => {
    mockFetch.mockReturnValueOnce(makeResponse({}));
    await get({ ...config, secure: true }, '/x');
    expect(mockFetch).toHaveBeenCalledWith('https://localhost:38470/api/x', expect.anything());
  });
});
