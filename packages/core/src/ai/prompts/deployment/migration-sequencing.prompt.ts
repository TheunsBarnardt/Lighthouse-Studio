import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

export const migrationSequencingPrompt = definePrompt({
  id: 'deployment/migration-sequencing',
  version: '1.0.0',
  description: 'Order schema migrations to be safe with the code deploy — additive first, destructive last',
  inputs: z.object({
    migrations: z.array(z.object({ id: z.string(), description: z.string(), sql: z.string() })),
    codeChangeSummary: z.string(),
  }),
  outputs: z.object({
    orderedMigrations: z.array(z.object({
      id: z.string(),
      sequence: z.number(),
      deployBefore: z.boolean(),
      reversible: z.boolean(),
      reasoning: z.string(),
    })),
    multiPhaseRequired: z.boolean(),
    multiPhaseWarning: z.string().optional(),
  }),
  modelConfig: { provider: 'anthropic',
 model: 'claude-haiku-4-5', maxTokens: 2000, temperature: 0.1 },
  systemPrompt: `You are a database migration expert. Order migrations for safe deployment:
1. Additive changes (new columns with defaults, new tables, indexes) deploy BEFORE code
2. Destructive changes (drop column, rename, type change) require multi-phase deployment
3. Flag irreversible operations clearly
Output ONLY valid JSON.`,
  userPromptTemplate: `Migrations:
{{migrations}}

Code change summary:
{{codeChangeSummary}}

Order migrations for safe deployment. Flag any that require multi-phase deployment.`,
  tests: [],
});
