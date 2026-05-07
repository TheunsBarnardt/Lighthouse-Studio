import type { RepositoryPort } from '@platform/ports-persistence';

import { ok, err } from 'neverthrow';
import { z } from 'zod';

import type { IntentBriefTemplate } from '../../../services/ai/intent-capture/types.js';

import { ValidationError } from '../../../errors.js';
import { INTENT_CAPTURE_PERMISSIONS } from '../../../services/ai/intent-capture/permissions.js';
import { defineTool } from '../../define-tool.js';

export function createSearchTemplatesTool(templateRepo: RepositoryPort<IntentBriefTemplate>) {
  return defineTool({
    id: 'intent-capture/search-templates',
    name: 'search_templates',
    description:
      'Searches the intent brief template library. Use this when the user seems to be building something that might match a template, to offer relevant starter suggestions.',
    parameters: z.object({
      query: z.string().describe('Search query — keywords describing the type of system'),
      category: z
        .string()
        .optional()
        .describe(
          'Filter by category (business, content, productivity, commerce, internal, customer-facing, technical, mobile, analytics, migration)',
        ),
    }),
    returns: z.object({
      templates: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string(),
          category: z.string(),
          starterMessage: z.string(),
        }),
      ),
      count: z.number(),
    }),
    permissions: [INTENT_CAPTURE_PERMISSIONS.READ],
    async execute(ctx, params) {
      if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

      const queryLower = params.query.toLowerCase();

      const templatesResult = await templateRepo.findMany({ includeArchived: false });
      const allTemplates = templatesResult.isOk() ? templatesResult.value.items : [];

      const filtered = allTemplates
        .filter((t: IntentBriefTemplate) => {
          const matchesCategory = !params.category || t.category === params.category;
          const matchesQuery =
            t.name.toLowerCase().includes(queryLower) ||
            t.description.toLowerCase().includes(queryLower) ||
            t.category.toLowerCase().includes(queryLower);
          return matchesCategory && matchesQuery;
        })
        .slice(0, 5)
        .map((t: IntentBriefTemplate) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          category: t.category,
          starterMessage: t.starterMessage,
        }));

      return ok({ templates: filtered, count: filtered.length });
    },
  });
}
