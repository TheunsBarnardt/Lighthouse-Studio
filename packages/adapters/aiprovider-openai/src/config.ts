export interface OpenAIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  organization?: string;
  maxRetries?: number;
  timeoutMs?: number;
}
