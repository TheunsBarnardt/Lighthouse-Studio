import type { StageName } from '@platform/ports-ai';
import type { RequestContext } from '@platform/ports-authorization';
import type { Result } from 'neverthrow';

import { ok } from 'neverthrow';
import { z } from 'zod';

import type { AppError } from '../../errors.js';
import type { ArtifactService } from '../../services/ai/artifact.service.js';

import { defineTool } from '../define-tool.js';

const STAGE_VALUES = [
  'intent',
  'prd',
  'design_tokens',
  'schema',
  'components',
  'server_functions',
  'auth',
  'deploy',
  'monitoring',
  'maintenance',
] as const;

const ParamsSchema = z.object({
  stage: z.enum(STAGE_VALUES).describe('Pipeline stage to list artifacts from.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Max items to return. Defaults to 20.'),
  offset: z.number().int().min(0).optional().describe('Pagination offset. Defaults to 0.'),
});

const ReturnSchema = z.object({
  stage: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      status: z.string(),
      currentVersion: z.number(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  count: z.number(),
});

type ListArtifactsReturn = z.infer<typeof ReturnSchema>;

/**
 * Creates the `list_artifacts` AI tool bound to the given ArtifactService.
 * Register this in the ToolRegistry at startup.
 */
export function createListArtifactsTool(artifacts: ArtifactService) {
  return defineTool<z.infer<typeof ParamsSchema>, ListArtifactsReturn>({
    id: 'list_artifacts',
    name: 'list_artifacts',
    description:
      'List AI-generated artifacts for a given pipeline stage in the current workspace. ' +
      'Use this to discover what artifacts exist before generating new ones that depend on prior stages.',
    parameters: ParamsSchema,
    returns: ReturnSchema,
    permissions: ['ai.artifact.read'],
    writesToPlatform: false,

    async execute(
      ctx: RequestContext,
      params: z.infer<typeof ParamsSchema>,
    ): Promise<Result<ListArtifactsReturn, AppError>> {
      const result = await artifacts.listByStage(ctx, params.stage as StageName, {
        limit: params.limit ?? 20,
        offset: params.offset ?? 0,
      });
      if (result.isErr()) return result as unknown as Result<ListArtifactsReturn, AppError>;

      const items = result.value;
      return ok({
        stage: params.stage,
        items: items.map((a) => ({
          id: a.id,
          type: a.type,
          status: a.status,
          currentVersion: a.currentVersion,
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
        })),
        count: items.length,
      });
    },
  });
}
