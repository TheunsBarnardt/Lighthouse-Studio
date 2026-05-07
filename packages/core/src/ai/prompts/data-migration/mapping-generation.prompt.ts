import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  sourceDescription: z.object({
    type: z.string(),
    tables: z.array(z.object({
      id: z.string(),
      name: z.string(),
      columns: z.array(z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        nullable: z.boolean(),
        sampleValues: z.array(z.unknown()),
      })),
      rowCount: z.number(),
      sampleRows: z.array(z.record(z.unknown())),
      primaryKey: z.array(z.string()).optional(),
      foreignKeys: z.array(z.any()).optional(),
    })),
    totalRowCount: z.number(),
  }),
  targetSchema: z.object({
    tables: z.array(z.object({
      id: z.string(),
      name: z.string(),
      columns: z.array(z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        nullable: z.boolean(),
        isPrimaryKey: z.boolean(),
        isForeignKey: z.boolean(),
        referencedTable: z.string().optional(),
      })),
    })),
  }),
  prdSummary: z.string(),
  userNotes: z.string().optional(),
  databaseDriver: z.string(),
});

const OutputSchema = z.object({
  tableMappings: z.array(z.object({
    sourceTableId: z.string(),
    targetTableId: z.string(),
    columnMappings: z.array(z.object({
      sourceColumnId: z.string().nullable(),
      targetColumnId: z.string(),
      literalValue: z.unknown().optional(),
      transformations: z.array(z.object({
        type: z.string(),
        parameters: z.record(z.unknown()),
        customExpression: z.string().optional(),
      })),
      reasoning: z.string(),
    })),
    splitInto: z.array(z.any()).optional(),
    reasoning: z.string(),
  })),
  unmappedSourceTables: z.array(z.object({
    tableId: z.string(),
    reason: z.string(),
  })),
  unmappedTargetColumns: z.array(z.object({
    tableId: z.string(),
    columnId: z.string(),
    required: z.boolean(),
    suggestion: z.string(),
  })),
  irreversibleOperations: z.array(z.object({
    description: z.string(),
    affectedTables: z.array(z.string()),
    reasoning: z.string(),
  })),
  coverageWarnings: z.array(z.string()),
  mappingNotes: z.string(),
  reasoning: z.string(),
});

export const mappingGenerationPrompt = definePrompt({
  id: 'data-migration.mapping-generation',
  version: '1.0.0',
  description: 'Generate a source-to-target column mapping plan from source introspection and target schema',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { provider: 'anthropic',
 model: 'claude-opus-4-7',
    maxTokens: 6000,
    temperature: 0.2,
  },
  systemPrompt: `You are a data migration expert who maps source database structures to target schemas.

Your task is to propose accurate, complete column-level mappings from the source to the target schema.

Rules:
- Map every required target column (nullable: false, no default) — unmapped required columns cause migration failures
- Prefer direct column mappings over transformations when types are compatible
- Apply transformations only when necessary (type mismatch, format difference)
- Flag irreversible operations (column splits that are lossy, data hashing)
- For many-to-many source patterns going to normalized target, describe the split strategy
- For FKs: propose resolve_by_natural_key transformations when source uses natural keys but target uses UUIDs
- Do not map source columns to target columns with fundamentally incompatible semantics
- When ambiguous, provide notes and let the user decide — don't guess blindly

Transformation types available:
String: trim, lowercase, uppercase, capitalize, slugify, regex_replace, regex_extract, split, join, substring, pad, mask
Number: parse_int, parse_float, round, multiply, divide, add, subtract
Date: parse_date, format_date, add_days, to_unix_timestamp
Boolean: parse_bool
JSON: parse_json, format_json, extract_path
Lookup: lookup_in_table, resolve_by_natural_key
Conditional: if_null, if_empty, default_if
Custom: js_expression

Capture reasoning for every mapping decision.`,
  userPromptTemplate: `Source type: {{sourceDescription.type}}
Total source rows: {{sourceDescription.totalRowCount}}

SOURCE TABLES:
{{#each sourceDescription.tables}}
Table: {{this.name}} ({{this.rowCount}} rows)
Columns: {{#each this.columns}}{{this.name}} ({{this.type}}, {{#if this.nullable}}nullable{{else}}NOT NULL{{/if}}) sample: {{JSON.stringify (slice this.sampleValues 0 3)}}; {{/each}}
Sample rows: {{JSON.stringify (slice this.sampleRows 0 3)}}
{{#if this.primaryKey}}Primary key: {{this.primaryKey}}{{/if}}
{{/each}}

TARGET SCHEMA ({{databaseDriver}}):
{{#each targetSchema.tables}}
Table: {{this.name}}
Columns: {{#each this.columns}}{{this.name}} ({{this.type}}, {{#if this.nullable}}nullable{{else}}NOT NULL{{/if}}{{#if this.isPrimaryKey}}, PK{{/if}}{{#if this.isForeignKey}}, FK→{{this.referencedTable}}{{/if}}); {{/each}}
{{/each}}

PRD CONTEXT:
{{prdSummary}}

{{#if userNotes}}USER NOTES:
{{userNotes}}{{/if}}

Generate the complete column-level migration mapping. Flag all ambiguities and irreversible operations.`,
  tests: [
    {
      description: 'Maps simple customer table from Postgres source to Postgres target',
      input: {
        sourceDescription: {
          type: 'postgres',
          totalRowCount: 500,
          tables: [{
            id: 'src_customers',
            name: 'customers',
            rowCount: 500,
            columns: [
              { id: 'c1', name: 'id', type: 'integer', nullable: false, sampleValues: [1, 2, 3] },
              { id: 'c2', name: 'full_name', type: 'varchar(255)', nullable: false, sampleValues: ['Alice Smith', 'Bob Jones'] },
              { id: 'c3', name: 'email', type: 'varchar(255)', nullable: false, sampleValues: ['alice@example.com'] },
              { id: 'c4', name: 'created', type: 'timestamp', nullable: false, sampleValues: ['2024-01-01T00:00:00Z'] },
            ],
            sampleRows: [{ id: 1, full_name: 'Alice Smith', email: 'alice@example.com', created: '2024-01-01' }],
          }],
        },
        targetSchema: {
          tables: [{
            id: 'tgt_users',
            name: 'users',
            columns: [
              { id: 't1', name: 'id', type: 'uuid', nullable: false, isPrimaryKey: true, isForeignKey: false },
              { id: 't2', name: 'email', type: 'text', nullable: false, isPrimaryKey: false, isForeignKey: false },
              { id: 't3', name: 'created_at', type: 'timestamptz', nullable: false, isPrimaryKey: false, isForeignKey: false },
            ],
          }],
        },
        prdSummary: 'CRM system for managing customers',
        databaseDriver: 'postgres',
      },
      assertions: [
        { path: 'tableMappings.0.sourceTableId', equals: 'src_customers' },
        { path: 'tableMappings.0.targetTableId', equals: 'tgt_users' },
      ],
    },
  ],
});
