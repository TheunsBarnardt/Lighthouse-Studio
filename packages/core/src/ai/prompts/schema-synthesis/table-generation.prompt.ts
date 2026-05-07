import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const columnSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  nullable: z.boolean(),
  defaultValue: z.string().optional(),
  description: z.string(),
  isPrimaryKey: z.boolean(),
  isForeignKey: z.boolean(),
  referencedTable: z.string().optional(),
  referencedColumn: z.string().optional(),
  piiCategories: z.array(z.string()),
  reasoning: z.string(),
  prdReferences: z.array(z.string()),
});

const inputs = z.object({
  entityName: z.string(),
  entityDescription: z.string(),
  entityAttributes: z.array(z.string()),
  relationships: z.array(z.object({ relatedTable: z.string(), type: z.string() })),
  databaseDriver: z.enum(['postgres', 'mssql', 'mongo']),
  capabilities: z.object({
    arrayColumns: z.boolean(),
    jsonColumns: z.boolean(),
    foreignKeysEnforced: z.boolean(),
  }),
  prdContext: z.string(),
});

const outputs = z.object({
  tableName: z.string(),
  description: z.string(),
  columns: z.array(columnSchema),
  isJunctionTable: z.boolean(),
  reasoning: z.string(),
  prdReferences: z.array(z.string()),
});

export const tableGenerationPrompt = definePrompt({
  id: 'schema-synthesis.table-generation',
  version: '1.0.0',
  description: 'Generate a database table with columns from an entity definition',
  inputs,
  outputs,
  modelConfig: { provider: 'anthropic',
 model: 'claude-opus-4-7', maxTokens: 3000, temperature: 0.2 },
  systemPrompt: `Generate a complete table definition in snake_case. Always include: id (UUID v7, PK), created_at (timestamp, default now()), updated_at (timestamp, default now()), _version (integer, default 1 for optimistic locking). Add domain columns based on the entity. Respect the database driver capabilities (no array columns for MSSQL; embedded docs for Mongo as JSONB). Flag PII columns. Use appropriate types for the driver. Add reasoning per column.`,
  userPromptTemplate: `Entity: {{entityName}} — {{entityDescription}}
Attributes: {{entityAttributes}}
Related tables: {{relationships}}
Database: {{databaseDriver}}
Capabilities: {{capabilities}}
PRD context: {{prdContext}}

Generate the complete table definition.`,
  tests: [
    {
      name: 'generates users table with standard columns',
      input: {
        entityName: 'User', entityDescription: 'Platform user who can log in',
        entityAttributes: ['email', 'display_name', 'role'], relationships: [],
        databaseDriver: 'postgres', capabilities: { arrayColumns: true, jsonColumns: true, foreignKeysEnforced: true },
        prdContext: 'Users authenticate via email and password.',
      },
      assertions: [
        (output: z.infer<typeof outputs>) => output.columns.some(c => c.isPrimaryKey),
        (output: z.infer<typeof outputs>) => output.columns.some(c => c.name === 'id' || c.name.endsWith('_id')),
        (output: z.infer<typeof outputs>) => output.columns.some(c => c.piiCategories.length > 0),
      ],
    },
  ],
});

registerPrompt(tableGenerationPrompt);
