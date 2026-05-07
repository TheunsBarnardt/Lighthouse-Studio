import { describe, it, expect, vi } from 'vitest';

import { DataQueryBuilder } from '../src/data/index.js';
import { setRuntime } from '../src/runtime/index.js';
import { HttpTransport } from '../src/transport/index.js';

function makeTransport(
  responseBody: unknown,
  status = 200,
): { transport: HttpTransport; fetchMock: ReturnType<typeof vi.fn> } {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(responseBody), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  setRuntime({ fetch: fetchMock as never, WebSocket: class {} as never, isBrowser: false });
  return {
    transport: new HttpTransport({ baseUrl: 'http://localhost:3000', retry: { maxAttempts: 1 } }),
    fetchMock,
  };
}

describe('DataQueryBuilder', () => {
  it('awaiting the builder executes a query', async () => {
    const { transport, fetchMock } = makeTransport({
      data: [{ id: '1', name: 'Alice' }],
      count: 1,
    });
    const builder = new DataQueryBuilder(transport, 'users', 'ws1', 'main');

    const result = await builder
      .select('id', 'name')
      .where({ name: { _eq: 'Alice' } })
      .limit(10);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.name).toBe('Alice');
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('sends correct body with filter and limit', async () => {
    const { transport, fetchMock } = makeTransport({ data: [] });
    const builder = new DataQueryBuilder<{ id: string; age: number }>(
      transport,
      'users',
      'ws1',
      'main',
    );

    await builder
      .where({ age: { _gt: 18 } })
      .limit(5)
      .orderBy('age', 'desc');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body['filter']).toEqual({ age: { _gt: 18 } });
    expect(body['limit']).toBe(5);
    expect(body['orderBy']).toEqual([{ field: 'age', direction: 'desc' }]);
  });

  it('insert sends to the insert endpoint', async () => {
    const { transport, fetchMock } = makeTransport({ data: { id: '2', name: 'Bob' } });
    const builder = new DataQueryBuilder<{ id: string; name: string }>(
      transport,
      'users',
      'ws1',
      'main',
    );

    const result = await builder.insert({ name: 'Bob' });
    expect(result.data.name).toBe('Bob');

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/insert');
  });

  it('first() limits to 1 row and returns null when empty', async () => {
    const { transport } = makeTransport({ data: [] });
    const builder = new DataQueryBuilder<{ id: string }>(transport, 'users', 'ws1', 'main');
    const row = await builder.first();
    expect(row).toBeNull();
  });

  it('count() calls the count endpoint', async () => {
    const { transport, fetchMock } = makeTransport({ count: 42 });
    const builder = new DataQueryBuilder<{ id: string }>(transport, 'users', 'ws1', 'main');
    const n = await builder.count();
    expect(n).toBe(42);
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain('/count');
  });

  it('builder is immutable — chaining returns new instance', () => {
    const { transport } = makeTransport({ data: [] });
    const b1 = new DataQueryBuilder<{ id: string }>(transport, 'users', 'ws1', 'main');
    const b2 = b1.limit(10);
    // Access private state through any to verify immutability
    expect((b1 as unknown as { state: { limitVal: null } }).state.limitVal).toBeNull();
    expect((b2 as unknown as { state: { limitVal: number } }).state.limitVal).toBe(10);
  });
});
