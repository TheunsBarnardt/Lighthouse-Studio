import type { ArtifactRepositoryPort } from '@platform/ports-ai-artifacts';

import { ok, err } from 'neverthrow';
import { z } from 'zod';

import { NotFoundError, ValidationError } from '../../../errors.js';
import { INTENT_CAPTURE_PERMISSIONS } from '../../../services/ai/intent-capture/permissions.js';
import { defineTool } from '../../define-tool.js';

export function createGetBriefDraftTool(artifactRepo: ArtifactRepositoryPort) {
  return defineTool({
    id: 'intent-capture/get-brief-draft',
    name: 'get_brief_draft',
    description:
      'Reads the current brief draft from the conversation artifact. Use this to see the current state of what has been captured so far.',
    parameters: z.object({
      conversationArtifactId: z.string().describe('The ID of the conversation artifact'),
    }),
    returns: z.object({
      briefDraft: z.unknown(),
      completenessPercent: z.number(),
      turnCount: z.number(),
    }),
    permissions: [INTENT_CAPTURE_PERMISSIONS.READ],
    async execute(ctx, params) {
      if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

      const found = await artifactRepo.findById(params.conversationArtifactId, ctx.workspaceId);
      if (found.isErr()) return err(new NotFoundError('artifact', params.conversationArtifactId));
      if (!found.value) return err(new NotFoundError('artifact', params.conversationArtifactId));

      const artifact = found.value;
      const content = artifact.content as { briefDraft?: unknown; turnCount?: number };
      const briefDraft = content.briefDraft ?? {};
      const draft = briefDraft as { completenessPercent?: number };

      return ok({
        briefDraft,
        completenessPercent: draft.completenessPercent ?? 0,
        turnCount: content.turnCount ?? 0,
      });
    },
  });
}
