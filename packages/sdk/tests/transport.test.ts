import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  UnauthorizedError,
  NotFoundError,
  ServerError,
  NetworkError,
} from '../src/errors/index.js';
import { setRuntime } from '../src/runtime/index.js';
import { HttpTransport } from '../src/transport/index.js';

function makeFetch(
  responses: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>,
): typeof fetch {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[i++] ?? { status: 200, body: {} };
    const hasBody = r.status !== 204 && r.body !== undefined;
    return new Response(hasBody ? JSON.stringify(r.body) : null, {
      status: r.status,
      headers: hasBody
        ? { 'Content-Type': 'application/json', ...(r.headers ?? {}) }
        : (r.headers ?? {}),
    });
  });
}

beforeEach(() => {
  setRuntime({
    fetch: makeFetch([{ status: 200, body: {} }]),
    WebSocket: class {} as never,
    isBrowser: false,
  });
});

describe('HttpTransport', () => {
  it('performs a GET request', async () => {
    const fetchMock = makeFetch([{ status: 200, body: { id: '1' } }]);
    setRuntime({ fetch: fetchMock, WebSocket: class {} as never, isBrowser: false });

    const t = new HttpTransport({ baseUrl: 'http://localhost:3000' });
    const result = await t.request<{ id: string }>({ path: '/api/v1/test' });

    expect(result.id).toBe('1');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('http://localhost:3000/api/v1/test');
    expect(init.method).toBe('GET');
  });

  it('sends Authorization header when token is present', async () => {
    const fetchMock = makeFetch([{ status: 200, body: {} }]);
    setRuntime({ fetch: fetchMock, WebSocket: class {} as never, isBrowser: false });

    const t = new HttpTransport({ baseUrl: 'http://localhost:3000', getToken: () => 'tok123' });
    await t.request({ path: '/api/v1/test' });

    const [, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok123');
  });

  it('adds Idempotency-Key on mutations', async () => {
    const fetchMock = makeFetch([{ status: 200, body: {} }]);
    setRuntime({ fetch: fetchMock, WebSocket: class {} as never, isBrowser: false });

    const t = new HttpTransport({ baseUrl: 'http://localhost:3000' });
    await t.request({ method: 'POST', path: '/api/v1/test', body: { x: 1 } });

    const [, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('throws UnauthorizedError on 401', async () => {
    const fetchMock = makeFetch([{ status: 401, body: { title: 'Unauthorized' } }]);
    setRuntime({ fetch: fetchMock, WebSocket: class {} as never, isBrowser: false });

    const t = new HttpTransport({ baseUrl: 'http://localhost:3000', retry: { maxAttempts: 1 } });
    await expect(t.request({ path: '/api/v1/test' })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('throws NotFoundError on 404', async () => {
    const fetchMock = makeFetch([{ status: 404, body: { title: 'Not found' } }]);
    setRuntime({ fetch: fetchMock, WebSocket: class {} as never, isBrowser: false });

    const t = new HttpTransport({ baseUrl: 'http://localhost:3000', retry: { maxAttempts: 1 } });
    await expect(t.request({ path: '/api/v1/test' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('retries on 500 up to maxAttempts', async () => {
    const fetchMock = makeFetch([
      { status: 500, body: { title: 'Error' } },
      { status: 500, body: { title: 'Error' } },
      { status: 200, body: { ok: true } },
    ]);
    setRuntime({ fetch: fetchMock, WebSocket: class {} as never, isBrowser: false });

    const t = new HttpTransport({
      baseUrl: 'http://localhost:3000',
      retry: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0 },
    });
    const result = await t.request<{ ok: boolean }>({ path: '/api/v1/test' });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws ServerError after exhausting retries', async () => {
    const fetchMock = makeFetch([
      { status: 500, body: { title: 'Error' } },
      { status: 500, body: { title: 'Error' } },
    ]);
    setRuntime({ fetch: fetchMock, WebSocket: class {} as never, isBrowser: false });

    const t = new HttpTransport({
      baseUrl: 'http://localhost:3000',
      retry: { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0 },
    });
    await expect(t.request({ path: '/api/v1/test' })).rejects.toBeInstanceOf(ServerError);
  });

  it('does not retry 4xx client errors', async () => {
    const fetchMock = makeFetch([{ status: 404, body: { title: 'Not found' } }]);
    setRuntime({ fetch: fetchMock, WebSocket: class {} as never, isBrowser: false });

    const t = new HttpTransport({ baseUrl: 'http://localhost:3000', retry: { maxAttempts: 3 } });
    await expect(t.request({ path: '/api/v1/test' })).rejects.toBeInstanceOf(NotFoundError);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('throws NetworkError on fetch failure', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    setRuntime({ fetch: fetchMock as never, WebSocket: class {} as never, isBrowser: false });

    const t = new HttpTransport({
      baseUrl: 'http://localhost:3000',
      retry: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });
    await expect(t.request({ path: '/api/v1/test' })).rejects.toBeInstanceOf(NetworkError);
  });

  it('returns undefined for 204 No Content', async () => {
    const fetchMock = makeFetch([{ status: 204 }]);
    setRuntime({ fetch: fetchMock, WebSocket: class {} as never, isBrowser: false });

    const t = new HttpTransport({ baseUrl: 'http://localhost:3000' });
    const result = await t.request({ method: 'DELETE', path: '/api/v1/test' });
    expect(result).toBeUndefined();
  });

  it('appends query parameters', async () => {
    const fetchMock = makeFetch([{ status: 200, body: [] }]);
    setRuntime({ fetch: fetchMock, WebSocket: class {} as never, isBrowser: false });

    const t = new HttpTransport({ baseUrl: 'http://localhost:3000' });
    await t.request({ path: '/api/v1/items', params: { limit: 10, cursor: 'abc' } });

    const [url] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toContain('limit=10');
    expect(url).toContain('cursor=abc');
  });
});
