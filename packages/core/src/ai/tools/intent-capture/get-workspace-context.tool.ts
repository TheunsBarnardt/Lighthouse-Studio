import type { Artifact, ArtifactRepositoryPort } from '@platform/ports-ai-artifacts';
import type { RepositoryPort } from '@platform/ports-persistence';

import { ok, err } from 'neverthrow';
import { z } from 'zod';

import { ValidationError } from '../../../errors.js';
import { INTENT_CAPTURE_PERMISSIONS } from '../../../services/ai/intent-capture/permissions.js';
import { defineTool } from '../../define-tool.js';

interface WorkspaceRecord {
  id: string;
  name: string;
  slug: string;
}

interface SchemaRecord {
  id: string;
  name: string;
  slug: string;
}

export function createGetWorkspaceContextTool(
  workspaceRepo: RepositoryPort<WorkspaceRecord>,
  schemaRepo: RepositoryPort<SchemaRecord>,
  artifactRepo: ArtifactRepositoryPort,
) {
  return defineTool({
    id: 'intent-capture/get-workspace-context',
    name: 'get_workspace_context',
    description:
      'Returns contextual information about the current workspace — name, existing schemas, and recent artifacts. Useful for tailoring questions to what already exists.',
    parameters: z.object({}),
    returns: z.object({
      workspaceName: z.string(),
      existingSchemaCount: z.number(),
      recentArtifactNames: z.array(z.string()),
    }),
    permissions: [INTENT_CAPTURE_PERMISSIONS.READ],
    async execute(ctx) {
      if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

      const workspaceResult = await workspaceRepo.findById(ctx.workspaceId);
      const workspaceName =
        (workspaceResult.isOk() && workspaceResult.value?.name) || 'this workspace';

      const schemasResult = await schemaRepo.findMany({});
      const existingSchemaCount = schemasResult.isOk() ? schemasResult.value.total : 0;

      const recentArtifacts = await artifactRepo.findMany(
        { workspaceId: ctx.workspaceId },
        { limit: 5, offset: 0 },
      );
      const recentArtifactNames = recentArtifacts.isOk()
        ? recentArtifacts.value.items.map((a: Artifact) => a.type).filter(Boolean)
        : [];

      return ok({ workspaceName, existingSchemaCount, recentArtifactNames });
    },
  });
}
