import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const inputs = z.object({
  tables: z.array(z.object({
    id: z.string(), name: z.string(),
    columns: z.array(z.object({ id: z.string(), name: z.string() })),
    indexes: z.array(z.object({ id: z.string() })),
  })),
  databaseDriver: z.enum(['postgres', 'mssql', 'mongo']),
  reservedWords: z.array(z.string()),
  identifierMaxLength: z.number(),
});

const outputs = z.object({
  issues: z.array(z.object({
    tableId: z.string(),
    columnId: z.string().optional(),
    issue: z.string(),
    severity: z.enum(['error', 'warning']),
    suggestedFix: z.string(),
  })),
  autoResolvable: z.array(z.object({
    tableId: z.string(),
    columnId: z.string().optional(),
    originalName: z.string(),
    resolvedName: z.string(),
  })),
  reasoning: z.string(),
});

export const namingValidationPrompt = definePrompt({
  id: 'schema-synthesis.naming-validation',
  version: '1.0.0',
  description: 'Validate table and column names against database naming rules',
  inputs,
  outputs,
  modelConfig: { provider: 'anthropic',
 model: 'claude-haiku-4-5-20251001', maxTokens: 1500, temperature: 0.0 },
  systemPrompt: `Validate naming. Check: snake_case convention, no reserved words, identifier length limits, no leading/trailing underscores, no consecutive underscores. Auto-resolve: camelCase → snake_case, reserved words → add prefix (e.g. order → order_record). Flag ambiguous cases for user review.`,
  userPromptTemplate: `Tables and columns: {{tables}}
Database: {{databaseDriver}}
Reserved words: {{reservedWords}}
Max identifier length: {{identifierMaxLength}}

Validate naming and suggest fixes.`,
  tests: [
    {
      name: 'flags reserved word',
      input: {
        tables: [{ id: 'tbl1', name: 'order', columns: [{ id: 'col1', name: 'id' }], indexes: [] }],
        databaseDriver: 'postgres', reservedWords: ['order'], identifierMaxLength: 63,
      },
      assertions: [
        (output: z.infer<typeof outputs>) => output.issues.some(i => i.tableId === 'tbl1') || output.autoResolvable.some(a => a.tableId === 'tbl1'),
      ],
    },
  ],
});

registerPrompt(namingValidationPrompt);
