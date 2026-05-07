import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  sourceDescription: z.object({
    type: z.string(),
    totalRowCount: z.number(),
    tables: z.array(z.object({ id: z.string(), name: z.string(), rowCount: z.number() })),
  }),
  targetSchema: z.object({
    tables: z.array(z.object({ id: z.string(), name: z.string() })),
  }),
  prdSummary: z.string(),
});

const OutputSchema = z.object({
  migrationStrategy: z.string(),
  mappingOrder: z.array(z.string()),
  specialConsiderations: z.array(z.string()),
  estimatedComplexity: z.enum(['low', 'medium', 'high']),
  estimatedCost: z.object({ minUsd: z.number(), maxUsd: z.number() }),
  reasoning: z.string(),
});

export const orchestratorPrompt = definePrompt({
  id: 'data-migration.orchestrator',
  version: '1.0.0',
  description: 'Top-level migration strategy planning before detailed mapping generation',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { provider: 'anthropic',
 model: 'claude-haiku-4-5-20251001',
    maxTokens: 1500,
    temperature: 0.2,
  },
  systemPrompt: `You plan the high-level strategy for a data migration before generating detailed mappings.

Determine:
- Migration strategy (direct, denormalized-to-normalized, document-to-relational, etc.)
- Order to process tables (dependency order: parent tables before child tables)
- Special considerations (large tables needing chunking, complex transformations, FK cycles)
- Complexity estimate
- Cost estimate for mapping generation ($0.50–$5.00 range)`,
  userPromptTemplate: `Source: {{sourceDescription.type}} with {{sourceDescription.tables.length}} tables, {{sourceDescription.totalRowCount}} total rows

Source tables: {{#each sourceDescription.tables}}{{this.name}} ({{this.rowCount}} rows), {{/each}}
Target tables: {{#each targetSchema.tables}}{{this.name}}, {{/each}}

PRD: {{prdSummary}}

Plan the migration strategy.`,
  tests: [
    {
      description: 'Plans simple direct migration',
      input: {
        sourceDescription: { type: 'postgres', totalRowCount: 1000, tables: [{ id: 's1', name: 'users', rowCount: 1000 }] },
        targetSchema: { tables: [{ id: 't1', name: 'users' }] },
        prdSummary: 'Simple user management system',
      },
      assertions: [
        { path: 'estimatedComplexity', oneOf: ['low', 'medium', 'high'] },
      ],
    },
  ],
});
