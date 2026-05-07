import type {
  AIProviderError,
  AIProviderPort,
  ChatMessage,
  GenerationEvent,
  GenerationRequest,
  GenerationResponse,
  HealthStatus,
  ModelInfo,
  TokenUsage,
  ToolDefinition,
} from '@platform/ports-ai-provider';

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
  ServiceUnavailableException,
  ThrottlingException,
  ValidationException,
} from '@aws-sdk/client-bedrock-runtime';
import { err, ok, type Result } from 'neverthrow';

import type { BedrockProviderConfig } from './config.js';

const DEFAULT_MODEL = 'anthropic.claude-opus-4-7-v1:0';

// Well-known Bedrock models
const BEDROCK_MODELS: ModelInfo[] = [
  {
    id: 'anthropic.claude-opus-4-7-v1:0',
    displayName: 'Claude Opus 4.7 (Bedrock)',
    contextWindow: 200_000,
    supportsToolUse: true,
    supportsStructuredOutput: true,
  },
  {
    id: 'anthropic.claude-sonnet-4-6-v1:0',
    displayName: 'Claude Sonnet 4.6 (Bedrock)',
    contextWindow: 200_000,
    supportsToolUse: true,
    supportsStructuredOutput: true,
  },
  {
    id: 'anthropic.claude-haiku-4-5-v1:0',
    displayName: 'Claude Haiku 4.5 (Bedrock)',
    contextWindow: 200_000,
    supportsToolUse: true,
    supportsStructuredOutput: true,
  },
  {
    id: 'amazon.titan-text-express-v1',
    displayName: 'Titan Text Express',
    contextWindow: 8_192,
    supportsToolUse: false,
    supportsStructuredOutput: false,
  },
  {
    id: 'amazon.titan-text-lite-v1',
    displayName: 'Titan Text Lite',
    contextWindow: 4_096,
    supportsToolUse: false,
    supportsStructuredOutput: false,
  },
];

interface ClaudeBedrockRequest {
  anthropic_version: string;
  max_tokens: number;
  messages: ClaudeBedrockMessage[];
  system?: string;
  tools?: ClaudeBedrockTool[];
  temperature?: number;
  stop_sequences?: string[];
}

interface ClaudeBedrockMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeBedrockContentBlock[];
}

interface ClaudeBedrockContentBlock {
  type: string;
  [key: string]: unknown;
}

interface ClaudeBedrockTool {
  name: string;
  description: string;
  input_schema: unknown;
}

interface ClaudeBedrockResponse {
  id: string;
  type: string;
  role: string;
  content: ClaudeBedrockResponseBlock[];
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface ClaudeBedrockResponseBlock {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

export class BedrockProvider implements AIProviderPort {
  readonly providerId = 'bedrock';

  private readonly client: BedrockRuntimeClient;
  private readonly config: BedrockProviderConfig;

  constructor(config: BedrockProviderConfig) {
    this.config = config;
    this.client = new BedrockRuntimeClient({
      region: config.region,
      ...(config.accessKeyId &&
        config.secretAccessKey && {
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            ...(config.sessionToken !== undefined && {
              sessionToken: config.sessionToken,
            }),
          },
        }),
      maxAttempts: config.maxRetries ?? 1,
    });
  }

  listModels(): Promise<Result<ModelInfo[], AIProviderError>> {
    return Promise.resolve(ok(BEDROCK_MODELS));
  }

  async generate(request: GenerationRequest): Promise<Result<GenerationResponse, AIProviderError>> {
    try {
      const startMs = Date.now();
      const model = request.model || this.config.defaultModel || DEFAULT_MODEL;

      const bedrockRequest: ClaudeBedrockRequest = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: request.maxTokens ?? 8192,
        messages: this.toClaudeMessages(request.messages),
        ...(request.systemPrompt !== undefined && { system: request.systemPrompt }),
        ...(request.temperature !== undefined && { temperature: request.temperature }),
        ...(request.stopSequences !== undefined && { stop_sequences: request.stopSequences }),
        ...(request.tools !== undefined && {
          tools: this.toClaudeTools(request.tools),
        }),
      };

      const command = new InvokeModelCommand({
        modelId: model,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(bedrockRequest),
      });

      const response = await this.client.send(command);
      const durationMs = Date.now() - startMs;

      const bodyText = new TextDecoder().decode(response.body);
      const body = JSON.parse(bodyText) as ClaudeBedrockResponse;

      let content = '';
      let structuredOutput: unknown;
      const toolCalls: GenerationResponse['toolCalls'] = [];

      for (const block of body.content) {
        if (block.type === 'text' && block.text !== undefined) {
          content += block.text;
        } else if (block.type === 'tool_use') {
          if (block.id && block.name) {
            toolCalls.push({
              type: 'tool_use',
              id: block.id,
              name: block.name,
              input: block.input ?? {},
            });
          }
        }
      }

      // If outputSchema provided, content may be JSON
      if (request.outputSchema !== undefined && content) {
        try {
          structuredOutput = JSON.parse(content) as unknown;
          content = '';
        } catch {
          // leave as plain text
        }
      }

      const usage: TokenUsage = {
        inputTokens: body.usage.input_tokens,
        outputTokens: body.usage.output_tokens,
      };

      return ok({
        content,
        ...(structuredOutput !== undefined && { structuredOutput }),
        ...(toolCalls.length > 0 && { toolCalls }),
        usage,
        model,
        stopReason: this.mapStopReason(body.stop_reason),
        durationMs,
      });
    } catch (e) {
      return err(this.mapError(e));
    }
  }

  async *generateStream(request: GenerationRequest): AsyncIterable<GenerationEvent> {
    const startMs = Date.now();
    const model = request.model || this.config.defaultModel || DEFAULT_MODEL;

    const bedrockRequest: ClaudeBedrockRequest = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: request.maxTokens ?? 8192,
      messages: this.toClaudeMessages(request.messages),
      ...(request.systemPrompt !== undefined && { system: request.systemPrompt }),
      ...(request.temperature !== undefined && { temperature: request.temperature }),
      ...(request.stopSequences !== undefined && { stop_sequences: request.stopSequences }),
      ...(request.tools !== undefined && {
        tools: this.toClaudeTools(request.tools),
      }),
    };

    try {
      const command = new InvokeModelWithResponseStreamCommand({
        modelId: model,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(bedrockRequest),
      });

      const response = await this.client.send(command);

      if (!response.body) {
        yield {
          type: 'error',
          code: 'provider_error',
          message: 'No response body from Bedrock',
          retryable: false,
        };
        return;
      }

      let currentToolUseId: string | undefined;
      let lastUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
      let lastStopReason = 'end_turn';

      for await (const chunk of response.body) {
        if (chunk.chunk?.bytes) {
          const text = new TextDecoder().decode(chunk.chunk.bytes);
          let event: Record<string, unknown>;
          try {
            event = JSON.parse(text) as Record<string, unknown>;
          } catch {
            continue;
          }

          const eventType = event['type'] as string | undefined;

          if (eventType === 'content_block_delta') {
            const delta = event['delta'] as Record<string, unknown> | undefined;
            if (delta?.['type'] === 'text_delta') {
              yield { type: 'text_delta', delta: delta['text'] as string };
            } else if (delta?.['type'] === 'input_json_delta' && currentToolUseId) {
              yield {
                type: 'tool_call_input_delta',
                toolUseId: currentToolUseId,
                delta: delta['partial_json'] as string,
              };
            }
          } else if (eventType === 'content_block_start') {
            const contentBlock = event['content_block'] as Record<string, unknown> | undefined;
            if (contentBlock?.['type'] === 'tool_use') {
              currentToolUseId = contentBlock['id'] as string;
              yield {
                type: 'tool_call_start',
                toolUseId: contentBlock['id'] as string,
                toolName: contentBlock['name'] as string,
              };
            }
          } else if (eventType === 'content_block_stop') {
            currentToolUseId = undefined;
          } else if (eventType === 'message_delta') {
            const delta = event['delta'] as Record<string, unknown> | undefined;
            if (delta?.['stop_reason']) {
              lastStopReason = delta['stop_reason'] as string;
            }
            const usage = event['usage'] as Record<string, unknown> | undefined;
            if (usage) {
              lastUsage = {
                inputTokens: lastUsage.inputTokens,
                outputTokens: (usage['output_tokens'] as number | undefined) ?? 0,
              };
            }
          } else if (eventType === 'message_start') {
            const message = event['message'] as Record<string, unknown> | undefined;
            const usage = message?.['usage'] as Record<string, unknown> | undefined;
            if (usage) {
              lastUsage = {
                inputTokens: (usage['input_tokens'] as number | undefined) ?? 0,
                outputTokens: (usage['output_tokens'] as number | undefined) ?? 0,
              };
            }
          } else if (eventType === 'message_stop') {
            yield {
              type: 'done',
              usage: lastUsage,
              durationMs: Date.now() - startMs,
              stopReason: this.mapStopReason(lastStopReason),
            };
          }
        }
      }
    } catch (e) {
      const mapped = this.mapError(e);
      yield {
        type: 'error',
        code: mapped.code,
        message: mapped.message,
        retryable: mapped.retryable,
      };
    }
  }

  async countTokens(text: string, _model: string): Promise<Result<number, AIProviderError>> {
    const estimate = Math.ceil(text.length / 4);
    return Promise.resolve(ok(estimate));
  }

  async healthCheck(): Promise<Result<HealthStatus, AIProviderError>> {
    try {
      const start = Date.now();
      const model = this.config.defaultModel ?? DEFAULT_MODEL;

      const bedrockRequest: ClaudeBedrockRequest = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      };

      const command = new InvokeModelCommand({
        modelId: model,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(bedrockRequest),
      });

      await this.client.send(command);
      return ok({ healthy: true, latencyMs: Date.now() - start });
    } catch (e) {
      return ok({ healthy: false, message: e instanceof Error ? e.message : String(e) });
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private toClaudeMessages(messages: ChatMessage[]): ClaudeBedrockMessage[] {
    return messages.map((m) => {
      const role: 'user' | 'assistant' = m.role === 'assistant' ? 'assistant' : 'user';

      if (typeof m.content === 'string') {
        return { role, content: m.content };
      }

      const content: ClaudeBedrockContentBlock[] = m.content.map((c) => {
        if (c.type === 'text') {
          return { type: 'text', text: c.text };
        }
        if (c.type === 'tool_use') {
          return {
            type: 'tool_use',
            id: c.id,
            name: c.name,
            input: c.input as Record<string, unknown>,
          };
        }
        // tool_result
        return {
          type: 'tool_result',
          tool_use_id: c.toolUseId,
          content: c.content,
          ...(c.isError !== undefined && { is_error: c.isError }),
        };
      });

      return { role, content };
    });
  }

  private toClaudeTools(tools: ToolDefinition[]): ClaudeBedrockTool[] {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
  }

  private mapStopReason(reason: string): GenerationResponse['stopReason'] {
    switch (reason) {
      case 'end_turn':
        return 'end_turn';
      case 'tool_use':
        return 'tool_use';
      case 'max_tokens':
        return 'max_tokens';
      case 'stop_sequence':
        return 'stop_sequence';
      default:
        return 'end_turn';
    }
  }

  private mapError(e: unknown): AIProviderError {
    if (e instanceof ThrottlingException) {
      return { code: 'rate_limit', message: e.message, retryable: true };
    }
    if (e instanceof ValidationException) {
      return { code: 'invalid_request', message: e.message, retryable: false };
    }
    if (e instanceof ServiceUnavailableException) {
      return { code: 'provider_error', message: e.message, retryable: true };
    }
    return {
      code: 'provider_error',
      message: e instanceof Error ? e.message : String(e),
      retryable: false,
    };
  }
}
