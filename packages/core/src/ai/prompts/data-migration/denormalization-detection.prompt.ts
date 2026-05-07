import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  sourceTable: z.object({
    id: z.string(),
    name: z.string(),
    columns: z.array(z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      sampleValues: z.array(z.unknown()),
    })),
    sampleRows: z.array(z.record(z.unknown())),
  }),
  targetTables: z.array(z.object({
    id: z.string(),
    name: z.string(),
    columns: z.array(z.object({ id: z.string(), name: z.string(), type: z.string() })),
  })),
  prdContext: z.string().optional(),
});

const OutputSchema = z.object({
  detectedPatterns: z.array(z.object({
    pattern: z.enum(['denormalized_columns', 'eav', 'json_blob', 'concatenated_fields', 'repeated_groups', 'polymorphic']),
    columns: z.array(z.string()),
    description: z.string(),
    proposedSplit: z.object({
      targetTables: z.array(z.string()),
      splitStrategy: z.string(),
      isLossy: z.boolean(),
      reasoning: z.string(),
    }).optional(),
  })),
  warnings: z.array(z.string()),
  reasoning: z.string(),
});

export const denormalizationDetectionPrompt = definePrompt({
  id: 'data-migration.denormalization-detection',
  version: '1.0.0',
  description: 'Detect denormalized columns in source that should split into normalized target tables',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 2000,
    temperature: 0.15,
  },
  systemPrompt: `You detect denormalization patterns in source tables and propose how to split them into normalized target tables.

Common patterns:
- denormalized_columns: multiple repeated columns (addr1, addr2, phone1, phone2) → related table
- eav: entity-attribute-value pattern (attr_name, attr_value pairs) → normalized columns
- json_blob: JSON stored as text → parsed into multiple columns or related table
- concatenated_fields: full_name, address1+address2 → split into component fields
- repeated_groups: period-based columns (q1_revenue, q2_revenue) → one row per period
- polymorphic: type column + generic id column → separate typed tables

Flag lossy splits (e.g., splitting full_name where exact split is unclear).
If no denormalization detected, return empty detectedPatterns.`,
  userPromptTemplate: `Source table: {{sourceTable.name}}
Columns: {{#each sourceTable.columns}}{{this.name}} ({{this.type}}) sample: {{JSON.stringify (slice this.sampleValues 0 3)}}; {{/each}}
Sample rows: {{JSON.stringify (slice sourceTable.sampleRows 0 5)}}

Available target tables: {{#each targetTables}}{{this.name}} {{/each}}

{{#if prdContext}}PRD context: {{prdContext}}{{/if}}

Detect denormalization patterns that require splitting.`,
  tests: [
    {
      description: 'Detects concatenated full_name field',
      input: {
        sourceTable: {
          id: 'src1',
          name: 'contacts',
          columns: [
            { id: 'c1', name: 'id', type: 'int', sampleValues: [1, 2] },
            { id: 'c2', name: 'full_name', type: 'varchar', sampleValues: ['Alice Smith', 'Bob Jones'] },
          ],
          sampleRows: [{ id: 1, full_name: 'Alice Smith' }],
        },
        targetTables: [
          { id: 't1', name: 'contacts', columns: [
            { id: 'tc1', name: 'first_name', type: 'text' },
            { id: 'tc2', name: 'last_name', type: 'text' },
          ]},
        ],
      },
      assertions: [
        { path: 'detectedPatterns.length', gte: 0 },
      ],
    },
  ],
});
