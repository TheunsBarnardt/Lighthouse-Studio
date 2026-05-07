import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BedrockProvider } from '../src/adapter.js';

vi.mock('@aws-sdk/client-bedrock-runtime', () => {
  class ThrottlingException extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ThrottlingException';
    }
  }
  class ValidationException extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationException';
    }
  }
  class ServiceUnavailableException extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ServiceUnavailableException';
    }
  }

  const mockSend = vi.fn();

  const MockBedrockRuntimeClient = vi.fn().mockImplementation(() => ({
    send: mockSend,
  }));

  const MockInvokeModelCommand = vi.fn().mockImplementation((input: unknown) => ({
    input,
  }));

  const MockInvokeModelWithResponseStreamCommand = vi.fn().mockImplementation((input: unknown) => ({
    input,
  }));

  return {
    BedrockRuntimeClient: MockBedrockRuntimeClient,
    InvokeModelCommand: MockInvokeModelCommand,
    InvokeModelWithResponseStreamCommand: MockInvokeModelWithResponseStreamCommand,
    ThrottlingException,
    ValidationException,
    ServiceUnavailableException,
  };
});

function makeRequest() {
  return {
    model: 'anthropic.claude-opus-4-7-v1:0',
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

function makeBedrockResponse(content: string, stopReason = 'end_turn') {
  const body = JSON.stringify({
    id: 'msg-1',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text: content }],
    model: 'anthropic.claude-opus-4-7-v1:0',
    stop_reason: stopReason,
    usage: { input_tokens: 10, output_tokens: 5 },
  });
  return {
    body: new TextEncoder().encode(body),
  };
}

describe('BedrockProvider', () => {
  let provider: BedrockProvider;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockSend: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    provider = new BedrockProvider({ region: 'us-east-1' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockSend = (provider as any).client.send;
  });

  describe('listModels()', () => {
    it('returns static well-known Bedrock models', async () => {
      const result = await provider.listModels();
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.length).toBeGreaterThan(0);
        expect(result.value.some((m) => m.id.includes('anthropic'))).toBe(true);
      }
    });
  });

  describe('generate() happy path', () => {
    it('returns a GenerationResponse on success', async () => {
      mockSend.mockResolvedValueOnce(makeBedrockResponse('Bedrock response'));

      const result = await provider.generate(makeRequest());

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.content).toBe('Bedrock response');
        expect(result.value.stopReason).toBe('end_turn');
        expect(result.value.usage.inputTokens).toBe(10);
        expect(result.value.usage.outputTokens).toBe(5);
      }
    });
  });

  describe('generate() error mapping', () => {
    it('maps ThrottlingException to rate_limit', async () => {
      const { ThrottlingException } = await import('@aws-sdk/client-bedrock-runtime');
      mockSend.mockRejectedValueOnce(new ThrottlingException('throttled'));

      const result = await provider.generate(makeRequest());

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('rate_limit');
        expect(result.error.retryable).toBe(true);
      }
    });

    it('maps ServiceUnavailableException to provider_error retryable', async () => {
      const { ServiceUnavailableException } = await import('@aws-sdk/client-bedrock-runtime');
      mockSend.mockRejectedValueOnce(new ServiceUnavailableException('service unavailable'));

      const result = await provider.generate(makeRequest());

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('provider_error');
        expect(result.error.retryable).toBe(true);
      }
    });

    it('maps ValidationException to invalid_request', async () => {
      const { ValidationException } = await import('@aws-sdk/client-bedrock-runtime');
      mockSend.mockRejectedValueOnce(new ValidationException('invalid'));

      const result = await provider.generate(makeRequest());

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe('invalid_request');
        expect(result.error.retryable).toBe(false);
      }
    });
  });

  describe('healthCheck()', () => {
    it('returns healthy: true when send succeeds', async () => {
      mockSend.mockResolvedValueOnce(makeBedrockResponse('ok'));

      const result = await provider.healthCheck();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.healthy).toBe(true);
        expect(result.value.latencyMs).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns healthy: false when send fails', async () => {
      mockSend.mockRejectedValueOnce(new Error('connection refused'));

      const result = await provider.healthCheck();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.healthy).toBe(false);
        expect(result.value.message).toContain('connection refused');
      }
    });
  });

  describe('countTokens()', () => {
    it('returns character-based estimate', async () => {
      const result = await provider.countTokens('Hello world!', 'anthropic.claude-opus-4-7-v1:0');
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // 12 chars / 4 = 3
        expect(result.value).toBe(3);
      }
    });
  });
});
