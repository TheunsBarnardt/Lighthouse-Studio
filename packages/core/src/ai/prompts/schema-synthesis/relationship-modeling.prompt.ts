import { z } from 'zod';
import { definePrompt, registerPrompt } from '../registry.js';

const inputs = z.object({
  relationships: z.array(z.object({
    from: z.string(), to: z.string(),
    type: z.enum(['one-to-one', 'one-to-many', 'many-to-many']),
    description: z.string(),
  })),
  generatedTables: z.array(z.object({ name: z.string(), id: z.string() })),
  databaseDriver: z.enum(['postgres', 'mssql', 'mongo']),
  capabilities: z.object({ arrayColumns: z.boolean(), foreignKeysEnforced: z.boolean() }),
});

const outputs = z.object({
  foreignKeys: z.array(z.object({
    fromTable: z.string(), fromColumn: z.string(),
    toTable: z.string(), toColumn: z.string(),
    onDelete: z.enum(['CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION']),
    reasoning: z.string(),
    prdJustification: z.string(),
  })),
  junctionTables: z.array(z.object({
    name: z.string(), leftTable: z.string(), rightTable: z.string(),
    leftColumn: z.string(), rightColumn: z.string(),
    additionalColumns: z.array(z.object({ name: z.string(), type: z.string(), description: z.string() })),
    reasoning: z.string(),
  })),
  advisoryReferences: z.array(z.object({
    fromCollection: z.string(), field: z.string(),
    toCollection: z.string(), reasoning: z.string(),
  })),
  reasoning: z.string(),
});

export const relationshipModelingPrompt = definePrompt({
  id: 'schema-synthesis.relationship-modeling',
  version: '1.0.0',
  description: 'Translate PRD relationships into FK constraints, junction tables, or document references',
  inputs,
  outputs,
  modelConfig: { model: 'claude-opus-4-7', maxTokens: 3000, temperature: 0.2 },
  systemPrompt: `Translate entity relationships to database-appropriate constructs. SQL: use FK columns for one-to-many, junction tables for many-to-many. MSSQL: never use array columns; always junction tables. Mongo: use embedded arrays for owned-by relationships; advisory references ($ref pattern) for many-to-many. Always add indexes on FK columns. Cascade delete only when the child entity cannot exist without the parent.`,
  userPromptTemplate: `Relationships: {{relationships}}
Generated tables: {{generatedTables}}
Database: {{databaseDriver}}
Capabilities: {{capabilities}}

Model all relationships appropriately for the target database.`,
  tests: [
    {
      name: 'models FK for one-to-many',
      input: {
        relationships: [{ from: 'users', to: 'posts', type: 'one-to-many', description: 'User authors posts' }],
        generatedTables: [{ name: 'users', id: 'tbl_users' }, { name: 'posts', id: 'tbl_posts' }],
        databaseDriver: 'postgres', capabilities: { arrayColumns: true, foreignKeysEnforced: true },
      },
      assertions: [
        (output: z.infer<typeof outputs>) => output.foreignKeys.length >= 1,
        (output: z.infer<typeof outputs>) => output.foreignKeys[0].fromTable === 'posts' || output.foreignKeys[0].toTable === 'users',
      ],
    },
  ],
});

registerPrompt(relationshipModelingPrompt);
