import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VllmProvider } from '../src/adapter.js';

// ── Mock the openai module ────────────────────────────────────────────────────

const mockCreate = vi.fn();
const mockModelsList = vi.fn();

vi.mock('openai', () => {
  class RateLimitError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'RateLimitError';
    }
  }
  class APIConnectionTimeoutError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'APIConnectionTimeoutError';
    }
  }
  class BadRequestError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'BadRequestError';
    }
  }
  class APIError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = 'APIError';
      this.status = status;
    }
  }

  const OpenAI = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
    models: {
      list: mockModelsList,
    },
  }));
  Object.assign(OpenAI, {
    RateLimitError,
    APIConnectionTimeoutError,
    BadRequestError,
    APIError,
  });

  return { default: OpenAI };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest() {
  return {
    model: 'meta-llama/Llama-3-8b-instruct',
    messages: [{ role: 'user' as const, content: 'Hello' }],
    metadata: {
      workspaceId: 'ws-1',
      promptId: 'test',
      promptVersion: '1.0.0',
      stage: 'test',
      correlationId: 'corr-1',
    },
  };
}

// Async generator helper for mockModelsList
async function* makeModelPage(ids: string[]) {
  for (const id of ids) {
    yield { id, object: 'model', created: 0, owned_by: 'vllm' };
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('VllmProvider', () => {
  let provider: VllmProvider;

  beforeEach(() => {
    provider = new VllmProvider({ baseUrl: 'http://localhost:8000/v1' });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generate() — happy path', () => {
    it('returns content and usage on success', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Hello from vLLM!' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 12, completion_tokens: 8 },
        model: 'meta-llama/Llama-3-8b-instruct',
      });

      const result = await provider.generate(makeRequest());

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.content).toBe('Hello from vLLM!');
        expect(result.value.usage.inputTokens).toBe(12);
        expect(result.value.usage.outputTokens).toBe(8);
        expect(result.value.stopReason).toBe('end_turn');
        expect(result.value.model).toBe('meta-llama/Llama-3-8b-instruct');
      }
    });

    it('passes systemPrompt as system message', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'response' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 20, completion_tokens: 5 },
        model: 'meta-llama/Llama-3-8b-instruct',
      });

      const req = { ...makeRequest(), systemPrompt: 'You are a helpful assistant.' };
      await provider.generate(req);

      const callArgs = mockCreate.mock.calls[0]?.[0] as { messages: Array<{ role: string; content: string }> };
      expect(callArgs.messages[0]).toEqual({ role: 'system', content: 'You are a helpful assistant.' });
    });

    it('maps finish_reason "length" to max_tokens', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'cut off' }, finish_reason: 'length' }],
        usage: { prompt_tokens: 5, completion_tokens: 256 },
        model: 'meta-llama/Llama-3-8b-instruct',
      });

      const result = await provider.generate(makeRequest());
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.stopReason).toBe('max_tokens');
      }
    });
  });

  describe('generate() — error mapping', () => {
    it('maps RateLimitError to rate_limit with retryable=true', async () => {
      const { default: OpenAI } = await import('openai');
      mockCreate.mockRejectedValueOnce(
        new (OpenAI as unknown as { RateLimitError: new (m: string) => Error }).RateLimitError(
          'rate limited',
        ),
      );

      const result = await provider.generate(makeRequest());
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('rate_limit');
        expect(result.error.retryable).toBe(true);
      }
    });

    it('maps APIConnectionTimeoutError to timeout', async () => {
      const { default: OpenAI } = await import('openai');
      mockCreate.mockRejectedValueOnce(
        new (
          OpenAI as unknown as { APIConnectionTimeoutError: new (m: string) => Error }
        ).APIConnectionTimeoutError('timed out'),
      );

      const result = await provider.generate(makeRequest());
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('timeout');
        expect(result.error.retryable).toBe(true);
      }
    });

    it('maps BadRequestError to invalid_request', async () => {
      const { default: OpenAI } = await import('openai');
      mockCreate.mockRejectedValueOnce(
        new (OpenAI as unknown as { BadRequestError: new (m: string) => Error }).BadRequestError(
          'invalid model',
        ),
      );

      const result = await provider.generate(makeRequest());
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('invalid_request');
        expect(result.error.retryable).toBe(false);
      }
    });

    it('maps 5xx APIError to provider_error with retryable=true', async () => {
      const { default: OpenAI } = await import('openai');
      mockCreate.mockRejectedValueOnce(
        new (OpenAI as unknown as { APIError: new (m: string, s: number) => Error }).APIError(
          'internal error',
          500,
        ),
      );

      const result = await provider.generate(makeRequest());
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('provider_error');
        expect(result.error.retryable).toBe(true);
        expect(result.error.providerCode).toBe('500');
      }
    });

    it('maps generic Error to provider_error with retryable=false', async () => {
      mockCreate.mockRejectedValueOnce(new Error('unexpected failure'));

      const result = await provider.generate(makeRequest());
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('provider_error');
        expect(result.error.retryable).toBe(false);
      }
    });
  });

  describe('listModels()', () => {
    it('returns models from the vLLM models endpoint', async () => {
      mockModelsList.mockReturnValueOnce(
        makeModelPage(['meta-llama/Llama-3-8b-instruct', 'mistralai/Mistral-7B-v0.1']),
      );

      const result = await provider.listModels();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0]?.id).toBe('meta-llama/Llama-3-8b-instruct');
        expect(result.value[1]?.id).toBe('mistralai/Mistral-7B-v0.1');
      }
    });

    it('returns err on failure', async () => {
      const { default: OpenAI } = await import('openai');
      mockModelsList.mockRejectedValueOnce(
        new (OpenAI as unknown as { APIError: new (m: string, s: number) => Error }).APIError(
          'unavailable',
          503,
        ),
      );

      const result = await provider.listModels();
      expect(result.isErr()).toBe(true);
    });
  });

  describe('countTokens()', () => {
    it('estimates token count as ceil(length/4)', async () => {
      const text = 'hello world'; // 11 chars → ceil(11/4) = 3
      const result = await provider.countTokens(text, 'any-model');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(3);
      }
    });
  });

  describe('healthCheck()', () => {
    it('returns healthy=true when models.list succeeds', async () => {
      mockModelsList.mockReturnValueOnce(makeModelPage([]));

      const result = await provider.healthCheck();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.healthy).toBe(true);
        expect(result.value.latencyMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns healthy=false when models.list fails', async () => {
      mockModelsList.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await provider.healthCheck();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.healthy).toBe(false);
        expect(result.value.message).toContain('ECONNREFUSED');
      }
    });
  });
});
