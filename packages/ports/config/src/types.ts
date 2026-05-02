import { z } from 'zod';

export type FeatureFlagType = 'boolean' | 'string' | 'number' | 'json';

export interface FeatureFlag {
  key: string;
  type: FeatureFlagType;
  value: unknown;
  description?: string;
  enabled: boolean;
}

export interface FeatureFlagContext {
  userId?: string;
  workspaceId?: string;
  environment?: string;
  attributes?: Record<string, unknown>;
}

export const FeatureFlagContextSchema = z.object({
  userId: z.string().optional(),
  workspaceId: z.string().optional(),
  environment: z.string().optional(),
  attributes: z.record(z.unknown()).optional(),
});
