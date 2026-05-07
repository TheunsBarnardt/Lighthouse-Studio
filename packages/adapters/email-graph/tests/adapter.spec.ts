import { describe, expect, it, vi, beforeEach } from 'vitest';

import { GraphEmailAdapter } from '../src/index.js';

vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: vi.fn().mockImplementation(() => ({
    getToken: vi.fn().mockResolvedValue({ token: 'mock-access-token' }),
  })),
}));

const config = {
  tenantId: 'test-tenant',
  clientId: 'test-client',
  fromAddress: 'noreply@example.com',
};

function makeAdapter() {
  return new GraphEmailAdapter(config);
}

const baseMessage = {
  to: [{ email: 'alice@example.com', name: 'Alice' }],
  subject: 'Test subject',
  bodyText: 'Hello world',
};

describe('GraphEmailAdapter', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('crypto', { randomUUID: () => 'mock-uuid' });
  });

  it('send() returns ok with messageId on 202 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(null, { status: 202 }) as Response,
    );

    const result = await makeAdapter().send(baseMessage);

    expect(result.isOk()).toBe(true);
    const sent = result._unsafeUnwrap();
    expect(sent.messageId).toBe('mock-uuid');
    expect(sent.accepted).toEqual(['alice@example.com']);
    expect(sent.rejected).toEqual([]);
  });

  it('send() POSTs to the correct Graph URL with bearer token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 202 }));

    await makeAdapter().send(baseMessage);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toContain('/users/noreply%40example.com/sendMail');
    expect(String(url)).toContain('graph.microsoft.com');
    const headers = init?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer mock-access-token');
  });

  it('send() uses HTML body when bodyHtml is provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 202 }));

    await makeAdapter().send({ ...baseMessage, bodyHtml: '<p>Hi</p>' });

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const payload = JSON.parse(init?.body as string) as {
      message: { body: { contentType: string } };
    };
    expect(payload.message.body.contentType).toBe('HTML');
  });

  it('send() includes cc/bcc when provided', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 202 }));

    await makeAdapter().send({
      ...baseMessage,
      cc: [{ email: 'cc@example.com' }],
      bcc: [{ email: 'bcc@example.com' }],
    });

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const payload = JSON.parse(init?.body as string) as {
      message: {
        ccRecipients: unknown[];
        bccRecipients: unknown[];
      };
    };
    expect(payload.message.ccRecipients).toHaveLength(1);
    expect(payload.message.bccRecipients).toHaveLength(1);
  });

  it('send() returns PROVIDER_ERROR on non-2xx HTTP status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Forbidden', { status: 403 }),
    );

    const result = await makeAdapter().send(baseMessage);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('PROVIDER_ERROR');
    expect(result._unsafeUnwrapErr().message).toContain('403');
  });

  it('send() returns PROVIDER_ERROR when fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network timeout'));

    const result = await makeAdapter().send(baseMessage);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('PROVIDER_ERROR');
  });

  it('send() returns PROVIDER_ERROR when credential.getToken throws', async () => {
    const { DefaultAzureCredential } = await import('@azure/identity');
    vi.mocked(DefaultAzureCredential).mockImplementationOnce(() => ({
      getToken: vi.fn().mockRejectedValueOnce(new Error('auth failure')),
    }));

    const result = await makeAdapter().send(baseMessage);

    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('PROVIDER_ERROR');
  });
});
