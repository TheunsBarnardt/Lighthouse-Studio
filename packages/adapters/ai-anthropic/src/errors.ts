import { AiError } from '@platform/ports-ai';

export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;

  const msg = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.constructor.name : '';

  if (name.includes('RateLimitError') || msg.includes('429')) {
    return new AiError('RATE_LIMITED', msg, error);
  }
  if (name.includes('ContextWindowExceededError') || msg.includes('context_length')) {
    return new AiError('CONTEXT_EXCEEDED', msg, error);
  }
  if (name.includes('ContentFilterError') || msg.includes('content_filter')) {
    return new AiError('CONTENT_FILTERED', msg, error);
  }
  if (name.includes('TimeoutError') || msg.includes('timeout')) {
    return new AiError('TIMEOUT', msg, error);
  }
  if (name.includes('APIError') || name.includes('AnthropicError')) {
    return new AiError('PROVIDER_ERROR', msg, error);
  }
  return new AiError('UNKNOWN', msg, error);
}
