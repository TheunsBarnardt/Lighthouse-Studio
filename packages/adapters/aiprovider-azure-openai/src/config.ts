export interface AzureOpenAIProviderConfig {
  endpoint: string;
  apiKey?: string;
  deploymentId: string;
  apiVersion?: string;
  defaultModel?: string;
  maxRetries?: number;
  timeoutMs?: number;
}
