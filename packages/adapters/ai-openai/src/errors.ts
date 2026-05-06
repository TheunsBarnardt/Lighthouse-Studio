import { AiError } from '@platform/ports-ai';

export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;

  const msg = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.constructor.name : '';

  if (name.includes('RateLimitError') || msg.includes('429') || msg.includes('rate_limit')) {
    return new AiError('RATE_LIMITED', msg, error);
  }
  if (msg.includes('context_length') || msg.includes('maximum context')) {
    return new AiError('CONTEXT_EXCEEDED', msg, error);
  }
  if (msg.includes('content_filter') || msg.includes('content_policy')) {
    return new AiError('CONTENT_FILTERED', msg, error);
  }
  if (name.includes('Timeout') || msg.includes('timeout')) {
    return new AiError('TIMEOUT', msg, error);
  }
  if (name.includes('APIError') || name.includes('OpenAI')) {
    return new AiError('PROVIDER_ERROR', msg, error);
  }
  return new AiError('UNKNOWN', msg, error);
}
