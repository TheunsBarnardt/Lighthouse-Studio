import { z } from 'zod';

export const ReleaseManifestSchema = z.object({
  version: z.string().min(1),
  minPreviousVersion: z.string().min(1),
  breakingMigrations: z.array(z.string()),
  expectedDowntimeSeconds: z.number().int().nonnegative(),
  rollbackSupported: z.boolean(),
});

export type ReleaseManifest = z.infer<typeof ReleaseManifestSchema>;

export function parseReleaseManifest(raw: unknown): ReleaseManifest {
  return ReleaseManifestSchema.parse(raw);
}
