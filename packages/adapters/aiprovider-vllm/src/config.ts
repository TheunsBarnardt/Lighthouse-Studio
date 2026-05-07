export interface VllmProviderConfig {
  baseUrl: string;
  apiKey?: string;
  defaultModel?: string;
  maxRetries?: number;
  timeoutMs?: number;
}
