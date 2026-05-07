import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const inputs = z.object({
  synthesizedTables: z.array(z.object({
    name: z.string(),
    columns: z.array(z.object({ name: z.string(), type: z.string() })),
  })),
  existingTables: z.array(z.object({
    id: z.string(),
    name: z.string(),
    columns: z.array(z.object({ name: z.string(), type: z.string() })),
  })),
  databaseDriver: z.enum(['postgres', 'mssql', 'mongo']),
});

const outputs = z.object({
  newTables: z.array(z.string()),
  modifiedTables: z.array(z.object({ tableName: z.string(), newColumns: z.array(z.string()) })),
  newForeignKeys: z.array(z.object({ fromTable: z.string(), fromColumn: z.string(), toTable: z.string(), reasoning: z.string() })),
  destructiveChanges: z.array(z.object({ tableId: z.string(), type: z.string(), description: z.string() })),
  reasoning: z.string(),
});

export const diffGenerationPrompt = definePrompt({
  id: 'schema-synthesis.diff-generation',
  version: '1.0.0',
  description: 'Generate an additive diff between synthesized and existing schema',
  inputs,
  outputs,
  modelConfig: { provider: 'anthropic',
 model: 'claude-haiku-4-5-20251001', maxTokens: 2048, temperature: 0.1 },
  systemPrompt: `Compare synthesized and existing schemas. Identify: new tables (in synthesis but not existing), new columns on existing tables, new foreign keys. NEVER propose dropping tables or columns automatically — only list them as potential destructive changes for user awareness. Additive changes are the primary output.`,
  userPromptTemplate: `Synthesized tables: {{synthesizedTables}}
Existing tables: {{existingTables}}
Database: {{databaseDriver}}

Generate a diff — what needs to be added to the existing schema.`,
  tests: [
    {
      name: 'identifies new tables',
      input: {
        synthesizedTables: [{ name: 'users', columns: [{ name: 'id', type: 'uuid' }] }, { name: 'posts', columns: [{ name: 'id', type: 'uuid' }] }],
        existingTables: [{ id: 'tbl_users', name: 'users', columns: [{ name: 'id', type: 'uuid' }] }],
        databaseDriver: 'postgres',
      },
      assertions: [
        (output: z.infer<typeof outputs>) => output.newTables.includes('posts'),
        (output: z.infer<typeof outputs>) => output.destructiveChanges.length === 0,
      ],
    },
  ],
});

registerPrompt(diffGenerationPrompt);
