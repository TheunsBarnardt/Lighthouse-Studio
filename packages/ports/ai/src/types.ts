import { z } from 'zod';

export type AiRole = 'user' | 'assistant' | 'system';

export interface AiMessage {
  role: AiRole;
  content: string;
}

export interface AiGenerationOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  systemPrompt?: string;
}

export interface AiGenerationResult {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'max_tokens' | 'content_filter' | 'unknown';
  reasoning?: string;
}

export interface AiStreamChunk {
  delta: string;
  done: boolean;
}

export const AiGenerationOptionsSchema = z.object({
  model: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  stopSequences: z.array(z.string()).optional(),
  systemPrompt: z.string().optional(),
});
