import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const inputs = z.object({
  tableName: z.string(),
  currentColumns: z.array(z.object({ name: z.string(), type: z.string(), description: z.string() })),
  feedback: z.string(),
  entityDescription: z.string(),
  databaseDriver: z.enum(['postgres', 'mssql', 'mongo']),
  relatedTables: z.array(z.string()),
});

const outputs = z.object({
  columns: z.array(z.object({
    id: z.string(), name: z.string(), type: z.string(), nullable: z.boolean(),
    defaultValue: z.string().optional(), description: z.string(),
    isPrimaryKey: z.boolean(), isForeignKey: z.boolean(),
    referencedTable: z.string().optional(), referencedColumn: z.string().optional(),
    piiCategories: z.array(z.string()), reasoning: z.string(), prdReferences: z.array(z.string()),
  })),
  reasoning: z.string(),
});

export const regenerationPrompt = definePrompt({
  id: 'schema-synthesis.regeneration',
  version: '1.0.0',
  description: 'Regenerate a single table with user feedback',
  inputs,
  outputs,
  modelConfig: { provider: 'anthropic',
 model: 'claude-opus-4-7', maxTokens: 2500, temperature: 0.3 },
  systemPrompt: `Regenerate a table's columns based on user feedback. Always preserve the standard columns (id, created_at, updated_at, _version). Apply the feedback meaningfully. Respect the database driver. Provide reasoning per column.`,
  userPromptTemplate: `Table: {{tableName}} — {{entityDescription}}
Current columns: {{currentColumns}}
User feedback: "{{feedback}}"
Database: {{databaseDriver}}
Related tables: {{relatedTables}}

Regenerate this table's columns applying the feedback.`,
  tests: [
    {
      name: 'regenerates table with feedback',
      input: {
        tableName: 'posts', currentColumns: [{ name: 'id', type: 'uuid', description: 'PK' }],
        feedback: 'Add support for draft/published status and featured flag',
        entityDescription: 'Blog posts', databaseDriver: 'postgres', relatedTables: ['users'],
      },
      assertions: [
        (output: z.infer<typeof outputs>) => output.columns.length >= 2,
        (output: z.infer<typeof outputs>) => output.reasoning.length > 20,
      ],
    },
  ],
});

registerPrompt(regenerationPrompt);
