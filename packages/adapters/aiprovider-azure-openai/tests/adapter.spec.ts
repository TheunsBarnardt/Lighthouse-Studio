import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AzureOpenAIProvider } from '../src/adapter.js';

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

  const MockAzureOpenAI = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));

  const MockOpenAI = vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));

  // Attach error classes as statics
  Object.assign(MockOpenAI, {
    APIError,
    RateLimitError,
    BadRequestError,
    APIConnectionTimeoutError,
  });

  Object.assign(MockAzureOpenAI, {
    APIError,
    RateLimitError,
    BadRequestError,
    APIConnectionTimeoutError,
  });

  return { default: MockOpenAI, AzureOpenAI: MockAzureOpenAI };
});

function makeRequest() {
  return {
    model: 'my-deployment',
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

describe('AzureOpenAIProvider', () => {
  let provider: AzureOpenAIProvider;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockClient: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    provider = new AzureOpenAIProvider({
      endpoint: 'https://my-resource.openai.azure.com',
      apiKey: 'test-key',
      deploymentId: 'my-deployment',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockClient = (provider as any).client;
  });

  describe('listModels()', () => {
    it('returns only the configured deployment', async () => {
      const result = await provider.listModels();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].id).toBe('my-deployment');
      }
    });
  });

  describe('generate() happy path', () => {
    it('returns a GenerationResponse on success', async () => {
      mockClient.chat.completions.create.mockResolvedValueOnce({
        choices: [
          {
            message: { content: 'Azure response', tool_calls: undefined },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 6 },
        model: 'my-deployment',
      });

      const result = await provider.generate(makeRequest());

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.content).toBe('Azure response');
        expect(result.value.stopReason).toBe('end_turn');
        expect(result.value.model).toBe('my-deployment');
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
      }
    });
  });

  describe('healthCheck()', () => {
    it('returns healthy: true when create succeeds', async () => {
      mockClient.chat.completions.create.mockResolvedValueOnce({
        choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
        model: 'my-deployment',
      });

      const result = await provider.healthCheck();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.healthy).toBe(true);
      }
    });

    it('returns healthy: false when create fails', async () => {
      mockClient.chat.completions.create.mockRejectedValueOnce(new Error('network error'));

      const result = await provider.healthCheck();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.healthy).toBe(false);
      }
    });
  });
});
