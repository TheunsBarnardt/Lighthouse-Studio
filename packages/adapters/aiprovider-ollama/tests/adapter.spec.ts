import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OllamaProvider } from '../src/adapter.js';

// ── Mock the openai module ────────────────────────────────────────────────────

const mockCreate = vi.fn();

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
  }));
  // Attach error classes as static properties
  Object.assign(OpenAI, {
    RateLimitError,
    APIConnectionTimeoutError,
    BadRequestError,
    APIError,
  });

  return { default: OpenAI };
});

// ── Mock fetch for listModels / healthCheck ───────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest() {
  return {
    model: 'llama3',
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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    provider = new OllamaProvider({ baseUrl: 'http://localhost:11434/v1', defaultModel: 'llama3' });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generate() — happy path', () => {
    it('returns content and usage on success', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Hi there!' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        model: 'llama3',
      });

      const result = await provider.generate(makeRequest());

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.content).toBe('Hi there!');
        expect(result.value.usage.inputTokens).toBe(10);
        expect(result.value.usage.outputTokens).toBe(5);
        expect(result.value.stopReason).toBe('end_turn');
        expect(result.value.model).toBe('llama3');
      }
    });

    it('maps finish_reason "length" to max_tokens stopReason', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'truncated' }, finish_reason: 'length' }],
        usage: { prompt_tokens: 8, completion_tokens: 512 },
        model: 'llama3',
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

    it('maps BadRequestError to invalid_request with retryable=false', async () => {
      const { default: OpenAI } = await import('openai');
      mockCreate.mockRejectedValueOnce(
        new (OpenAI as unknown as { BadRequestError: new (m: string) => Error }).BadRequestError(
          'bad input',
        ),
      );

      const result = await provider.generate(makeRequest());
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('invalid_request');
        expect(result.error.retryable).toBe(false);
      }
    });

    it('maps generic error to provider_error', async () => {
      mockCreate.mockRejectedValueOnce(new Error('something exploded'));

      const result = await provider.generate(makeRequest());
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('provider_error');
        expect(result.error.message).toBe('something exploded');
      }
    });
  });

  describe('listModels()', () => {
    it('returns mapped models from Ollama tags API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          models: [
            { name: 'llama3', details: { parameter_size: '8B' } },
            { name: 'mistral', details: {} },
          ],
        }),
      });

      const result = await provider.listModels();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0]?.id).toBe('llama3');
        expect(result.value[1]?.id).toBe('mistral');
      }
    });

    it('returns ok([]) when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('connection refused'));

      const result = await provider.listModels();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual([]);
      }
    });

    it('returns ok([]) when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

      const result = await provider.listModels();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual([]);
      }
    });
  });

  describe('countTokens()', () => {
    it('estimates token count via character length / 4', async () => {
      const text = 'a'.repeat(100);
      const result = await provider.countTokens(text, 'llama3');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBe(25);
      }
    });
  });

  describe('healthCheck()', () => {
    it('returns healthy=true when Ollama is reachable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [] }),
      });

      const result = await provider.healthCheck();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.healthy).toBe(true);
        expect(result.value.latencyMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns healthy=false when Ollama is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await provider.healthCheck();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.healthy).toBe(false);
        expect(result.value.message).toContain('ECONNREFUSED');
      }
    });
  });
});
