import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  sourceRelationships: z.array(z.object({
    sourceTable: z.string(),
    sourceColumn: z.string(),
    referencedTable: z.string(),
    referencedColumn: z.string(),
    relationshipType: z.enum(['one_to_one', 'one_to_many', 'many_to_many']),
  })),
  targetSchema: z.object({
    tables: z.array(z.object({
      id: z.string(),
      name: z.string(),
      columns: z.array(z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        isPrimaryKey: z.boolean(),
        isForeignKey: z.boolean(),
        referencedTable: z.string().optional(),
      })),
    })),
  }),
  databaseDriver: z.string(),
});

const OutputSchema = z.object({
  strategies: z.array(z.object({
    sourceRelationship: z.string(),
    strategy: z.enum(['direct_copy', 'resolve_by_natural_key', 'junction_table', 'embed_document', 'drop']),
    naturalKeyColumns: z.array(z.string()).optional(),
    junctionTable: z.string().optional(),
    details: z.string(),
    reasoning: z.string(),
  })),
  warnings: z.array(z.string()),
  reasoning: z.string(),
});

export const fkResolutionStrategyPrompt = definePrompt({
  id: 'data-migration.fk-resolution-strategy',
  version: '1.0.0',
  description: 'Determine how to preserve or transform foreign key relationships during migration',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 2000,
    temperature: 0.1,
  },
  systemPrompt: `You determine how to handle foreign key relationships when migrating from source to target schema.

Strategies:
- direct_copy: source FK value directly maps to target FK column (IDs match)
- resolve_by_natural_key: source uses a natural key (email, code, name); target uses UUID; resolve via lookup
- junction_table: many-to-many split into a junction table in target
- embed_document: for MongoDB targets, embed related document instead of FK
- drop: relationship not preserved in target (document intentional reason)

For resolve_by_natural_key, specify which columns to use as the lookup key.
For MongoDB targets, prefer embed_document for one-to-one and one-to-many when appropriate.
For SQL targets, prefer resolve_by_natural_key when IDs differ.`,
  userPromptTemplate: `Target database: {{databaseDriver}}

Source relationships:
{{#each sourceRelationships}}
- {{this.sourceTable}}.{{this.sourceColumn}} → {{this.referencedTable}}.{{this.referencedColumn}} ({{this.relationshipType}})
{{/each}}

Target schema tables: {{#each targetSchema.tables}}{{this.name}} {{/each}}

Determine the FK resolution strategy for each relationship.`,
  tests: [
    {
      description: 'Resolves natural-key FK for email-based customer references',
      input: {
        sourceRelationships: [{
          sourceTable: 'orders',
          sourceColumn: 'customer_email',
          referencedTable: 'customers',
          referencedColumn: 'email',
          relationshipType: 'many_to_many',
        }],
        targetSchema: {
          tables: [
            { id: 't1', name: 'orders', columns: [{ id: 'c1', name: 'customer_id', type: 'uuid', isPrimaryKey: false, isForeignKey: true, referencedTable: 'users' }] },
            { id: 't2', name: 'users', columns: [{ id: 'c2', name: 'email', type: 'text', isPrimaryKey: false, isForeignKey: false }] },
          ],
        },
        databaseDriver: 'postgres',
      },
      assertions: [
        { path: 'strategies.0.strategy', equals: 'resolve_by_natural_key' },
      ],
    },
  ],
});
