export interface BedrockProviderConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  defaultModel?: string;
  maxRetries?: number;
  timeoutMs?: number;
}
