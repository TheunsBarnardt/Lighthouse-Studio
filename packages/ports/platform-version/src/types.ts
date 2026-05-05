import { z } from 'zod';

export interface PlatformVersion {
  /** Semver string, e.g. "1.2.0" or "1.2.0-rc.1" */
  releaseVersion: string;
  appliedAt: Date;
  /** User ID of the operator who ran the upgrade; null for automated first-install. */
  appliedBy?: string;
  /** Migration name high-water mark at the time of recording (e.g. "0009_platform_versions"). */
  schemaMigrationHighWater?: string;
  notes?: string;
}

export const PlatformVersionSchema = z.object({
  releaseVersion: z.string().min(1).max(64),
  appliedAt: z.date(),
  appliedBy: z.string().optional(),
  schemaMigrationHighWater: z.string().max(128).optional(),
  notes: z.string().optional(),
});

export const RecordVersionInputSchema = z.object({
  releaseVersion: z.string().min(1).max(64),
  appliedBy: z.string().optional(),
  schemaMigrationHighWater: z.string().max(128).optional(),
  notes: z.string().optional(),
});

export type RecordVersionInput = z.infer<typeof RecordVersionInputSchema>;
