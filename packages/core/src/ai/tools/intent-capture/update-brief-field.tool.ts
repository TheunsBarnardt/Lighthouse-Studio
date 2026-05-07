import type { ArtifactRepositoryPort } from '@platform/ports-ai-artifacts';

import { ok, err } from 'neverthrow';
import { z } from 'zod';

import type { BriefDraft, BriefFieldStatus } from '../../../services/ai/intent-capture/types.js';

import { NotFoundError, ValidationError } from '../../../errors.js';
import { INTENT_CAPTURE_PERMISSIONS } from '../../../services/ai/intent-capture/permissions.js';
import { defineTool } from '../../define-tool.js';

export function createUpdateBriefFieldTool(artifactRepo: ArtifactRepositoryPort) {
  return defineTool({
    id: 'intent-capture/update-brief-field',
    name: 'update_brief_field',
    description:
      'Proposes an update to a specific field in the brief draft. Updates are tentative until the AI reaches high confidence. Use this to capture new information as it emerges in the conversation.',
    parameters: z.object({
      conversationArtifactId: z.string().describe('The ID of the conversation artifact'),
      fieldName: z
        .string()
        .describe(
          'The name of the brief field to update (e.g., "goals", "targetUsers", "inScope")',
        ),
      value: z.unknown().describe('The new value for the field'),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .describe('Confidence in this update (0.0-1.0). Above 0.7 = confident, below = tentative'),
      sourceExcerpt: z
        .string()
        .optional()
        .describe('The part of the conversation that led to this update'),
    }),
    returns: z.object({
      updated: z.boolean(),
      fieldStatus: z.string(),
      message: z.string(),
    }),
    permissions: [INTENT_CAPTURE_PERMISSIONS.READ],
    async execute(ctx, params) {
      if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

      const found = await artifactRepo.findById(params.conversationArtifactId, ctx.workspaceId);
      if (found.isErr() || !found.value)
        return err(new NotFoundError('artifact', params.conversationArtifactId));

      const artifact = found.value;
      const content = artifact.content as { briefDraft?: BriefDraft; turnCount?: number };
      const draft: BriefDraft = content.briefDraft ?? {
        goals: [],
        targetUsers: [],
        successCriteria: [],
        inScope: [],
        outOfScope: [],
        constraints: [],
        assumptions: [],
        risks: [],
        references: [],
        fieldStates: {},
        completenessPercent: 0,
        readyToGenerate: false,
      };

      const status: BriefFieldStatus = params.confidence >= 0.7 ? 'confident' : 'tentative';

      // Update the field
      const updatedDraft: BriefDraft = {
        ...draft,
        [params.fieldName]: params.value,
        fieldStates: {
          ...draft.fieldStates,
          [params.fieldName]: {
            status,
            sourceExcerpts: [
              ...(draft.fieldStates[params.fieldName]?.sourceExcerpts ?? []),
              ...(params.sourceExcerpt ? [params.sourceExcerpt] : []),
            ].slice(-3),
            lastUpdatedTurn: content.turnCount ?? 0,
          },
        },
      };

      await artifactRepo.update({
        id: params.conversationArtifactId,
        workspaceId: ctx.workspaceId,
        expectedVersion: artifact.currentVersion,
        content: { ...content, briefDraft: updatedDraft },
      });

      return ok({
        updated: true,
        fieldStatus: status,
        message: `Updated ${params.fieldName} with ${status} confidence`,
      });
    },
  });
}
