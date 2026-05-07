import { z } from 'zod';

// ── Model config ───────────────────────────────────────────────────────────────

export interface ModelConfig {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

// ── Messages ──────────────────────────────────────────────────────────────────

export type ChatRole = 'user' | 'assistant' | 'tool';

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResultContent {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export type MessageContent = TextContent | ToolUseContent | ToolResultContent;

export interface ChatMessage {
  role: ChatRole;
  content: string | MessageContent[];
}

// ── Tool definitions ──────────────────────────────────────────────────────────

export interface JsonSchema {
  type: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  description?: string;
  [key: string]: unknown;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  inputSchema: JsonSchema;
}

// ── Generation metadata ───────────────────────────────────────────────────────

export interface GenerationMetadata {
  workspaceId: string;
  userId?: string;
  promptId: string;
  promptVersion: string;
  stage: string;
  correlationId: string;
}

// ── Request ───────────────────────────────────────────────────────────────────

export interface GenerationRequest {
  model: string;
  systemPrompt?: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  outputSchema?: JsonSchema;
  metadata: GenerationMetadata;
}

// ── Response ──────────────────────────────────────────────────────────────────

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface GenerationResponse {
  content: string;
  structuredOutput?: unknown;
  toolCalls?: ToolUseContent[];
  usage: TokenUsage;
  model: string;
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
  durationMs: number;
}

// ── Streaming events ──────────────────────────────────────────────────────────

export interface TextDeltaEvent {
  type: 'text_delta';
  delta: string;
}

export interface ToolCallStartEvent {
  type: 'tool_call_start';
  toolUseId: string;
  toolName: string;
}

export interface ToolCallInputDeltaEvent {
  type: 'tool_call_input_delta';
  toolUseId: string;
  delta: string;
}

export interface ToolCallCompleteEvent {
  type: 'tool_call_complete';
  toolUseId: string;
  toolName: string;
  input: unknown;
  result?: unknown;
  error?: string;
}

export interface GenerationDoneEvent {
  type: 'done';
  usage: TokenUsage;
  durationMs: number;
  stopReason: GenerationResponse['stopReason'];
}

export interface GenerationErrorEvent {
  type: 'error';
  code: string;
  message: string;
  retryable: boolean;
}

export type GenerationEvent =
  | TextDeltaEvent
  | ToolCallStartEvent
  | ToolCallInputDeltaEvent
  | ToolCallCompleteEvent
  | GenerationDoneEvent
  | GenerationErrorEvent;

// ── Health / discovery ────────────────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  displayName: string;
  contextWindow: number;
  supportsToolUse: boolean;
  supportsStructuredOutput: boolean;
}

export interface HealthStatus {
  healthy: boolean;
  latencyMs?: number;
  message?: string;
}

// ── Zod schemas (for runtime validation) ─────────────────────────────────────

export const ModelConfigSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  stopSequences: z.array(z.string()).optional(),
});
