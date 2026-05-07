import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIProvider } from '../src/adapter.js';

// Mock the openai module
vi.mock('openai', async () => {
  class APIError extends Error {
    status: number;
    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  }
  class RateLimitError extends APIError {
    constructor(message: string) {
      super(message, 429);
    }
  }
  class BadRequestError extends APIError {
    constructor(message: string) {
      super(message, 400);
    }
  }
  class APIConnectionTimeoutError extends APIError {
    constructor(message: string) {
      super(message, 0);
    }
  }

  const mockCreate = vi.fn();
  const mockModelsList = vi.fn();

  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
    models: {
      list: mockModelsList,
    },
  }));

  // Attach error classes as statics
  Object.assign(MockOpenAI, {
    APIError,
    RateLimitError,
    BadRequestError,
    APIConnectionTimeoutError,
  });

  return { default: MockOpenAI };
});

function makeRequest() {
  return {
    model: 'gpt-4o',
    messages: [{ role: 'user' as const, content: 'Hello' }],
    metadata: {
      workspaceId: 'ws-1',
      promptId: 'p-1',
      promptVersion: '1.0.0',
      stage: 'test',
      correlationId: 'corr-1',
    },
  };
}

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    provider = new OpenAIProvider({ apiKey: 'test-key' });
    // Access the private client for mock setup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockClient = (provider as any).client;
  });

  describe('generate() happy path', () => {
    it('returns a GenerationResponse on success', async () => {
      mockClient.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: { content: 'Hello world', tool_calls: undefined },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        model: 'gpt-4o',
      });

      const result = await provider.generate(makeRequest());

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.content).toBe('Hello world');
        expect(result.value.stopReason).toBe('end_turn');
        expect(result.value.usage.inputTokens).toBe(10);
        expect(result.value.usage.outputTokens).toBe(5);
      }
    });

    it('maps finish_reason tool_calls to tool_use stopReason', async () => {
      mockClient.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'tc-1',
                  type: 'function',
                  function: { name: 'my_tool', arguments: '{"key":"val"}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 15, completion_tokens: 8 },
        model: 'gpt-4o',
      });

      const result = await provider.generate(makeRequest());

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.stopReason).toBe('tool_use');
        expect(result.value.toolCalls).toHaveLength(1);
        expect(result.value.toolCalls![0].name).toBe('my_tool');
      }
    });
  });

  describe('generate() error mapping', () => {
    it('maps RateLimitError to rate_limit', async () => {
      const OpenAI = (await import('openai')).default;
      mockClient.chat.completions.create.mockRejectedValueOnce(
        new (OpenAI as any).RateLimitError('rate limited'),
      );

      const result = await provider.generate(makeRequest());

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('rate_limit');
        expect(result.error.retryable).toBe(true);
      }
    });

    it('maps generic APIError (5xx) to provider_error retryable', async () => {
      const OpenAI = (await import('openai')).default;
      mockClient.chat.completions.create.mockRejectedValueOnce(
        new (OpenAI as any).APIError('server error', 503),
      );

      const result = await provider.generate(makeRequest());

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('provider_error');
        expect(result.error.retryable).toBe(true);
        expect(result.error.providerCode).toBe('503');
      }
    });

    it('maps BadRequestError to invalid_request', async () => {
      const OpenAI = (await import('openai')).default;
      mockClient.chat.completions.create.mockRejectedValueOnce(
        new (OpenAI as any).BadRequestError('bad request'),
      );

      const result = await provider.generate(makeRequest());

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('invalid_request');
        expect(result.error.retryable).toBe(false);
      }
    });
  });

  describe('healthCheck()', () => {
    it('returns healthy: true when models.list succeeds', async () => {
      mockClient.models.list.mockResolvedValueOnce({ data: [] });

      const result = await provider.healthCheck();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.healthy).toBe(true);
        expect(result.value.latencyMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns healthy: false when models.list fails', async () => {
      mockClient.models.list.mockRejectedValueOnce(new Error('connection refused'));

      const result = await provider.healthCheck();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.healthy).toBe(false);
        expect(result.value.message).toContain('connection refused');
      }
    });
  });

  describe('countTokens()', () => {
    it('returns a character-based estimate', async () => {
      const result = await provider.countTokens('Hello world!', 'gpt-4o');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // 12 chars / 4 = 3
        expect(result.value).toBe(3);
      }
    });
  });
});
