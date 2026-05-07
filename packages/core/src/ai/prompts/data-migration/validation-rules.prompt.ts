import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  tableMappings: z.array(z.object({
    sourceTableId: z.string(),
    targetTableId: z.string(),
    columnMappings: z.array(z.object({
      sourceColumnId: z.string().nullable(),
      targetColumnId: z.string(),
      transformations: z.array(z.object({ type: z.string(), parameters: z.record(z.unknown()) })),
    })),
  })),
  targetSchema: z.object({
    tables: z.array(z.object({
      id: z.string(),
      columns: z.array(z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        nullable: z.boolean(),
        maxLength: z.number().optional(),
      })),
    })),
  }),
  sourceDescription: z.object({
    type: z.string(),
    tables: z.array(z.object({ id: z.string(), columns: z.array(z.any()) })),
  }),
});

const OutputSchema = z.object({
  columnValidations: z.array(z.object({
    targetTableId: z.string(),
    targetColumnId: z.string(),
    rules: z.array(z.object({
      type: z.string(),
      parameters: z.record(z.unknown()),
      errorMessage: z.string().optional(),
    })),
    reasoning: z.string(),
  })),
  preExecutionChecks: z.array(z.object({
    type: z.string(),
    description: z.string(),
  })),
  postExecutionChecks: z.array(z.object({
    type: z.string(),
    description: z.string(),
    expectedValue: z.unknown().optional(),
  })),
  reasoning: z.string(),
});

export const validationRulesPrompt = definePrompt({
  id: 'data-migration.validation-rules',
  version: '1.0.0',
  description: 'Generate per-column validation rules and pre/post execution checks for a migration plan',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { provider: 'anthropic',
 model: 'claude-haiku-4-5-20251001',
    maxTokens: 2000,
    temperature: 0.1,
  },
  systemPrompt: `You generate validation rules for migration plans to catch data quality issues early.

Per-column validation rule types:
- not_null: column value must not be null after transformation
- max_length: string value must not exceed N characters (prevents truncation)
- regex: value must match pattern (e.g., email format, phone format)
- range: numeric value must be within [min, max]
- custom: js_expression returning true/false

Post-execution checks (always include standard set):
- row_count_match: target row count = expected source rows
- fk_integrity: all FK columns reference existing rows
- no_truncation: no varchar columns at exactly max length
- required_columns_populated: no NULL in NOT NULL columns
- sample_comparison: 100 random rows verified correct

Add column-level rules for:
- Email columns: regex validation
- URL columns: regex validation
- Date columns: range validation (not in far future)
- UUID columns: format validation post-transformation
- Numeric columns that had type changes: range validation`,
  userPromptTemplate: `Source type: {{sourceDescription.type}}

Table mappings: {{tableMappings.length}} tables

Target schema columns with constraints:
{{#each targetSchema.tables}}
Table {{this.id}}:
{{#each this.columns}}
  - {{this.name}} ({{this.type}}, {{#if this.nullable}}nullable{{else}}NOT NULL{{/if}}{{#if this.maxLength}}, maxLen={{this.maxLength}}{{/if}})
{{/each}}
{{/each}}

Generate validation rules. Always include the 5 standard post-execution checks.`,
  tests: [
    {
      description: 'Generates standard post-execution checks for any mapping',
      input: {
        tableMappings: [{
          sourceTableId: 'src1',
          targetTableId: 'tgt1',
          columnMappings: [{ sourceColumnId: 'c1', targetColumnId: 't1', transformations: [] }],
        }],
        targetSchema: { tables: [{ id: 'tgt1', columns: [{ id: 't1', name: 'email', type: 'text', nullable: false }] }] },
        sourceDescription: { type: 'postgres', tables: [{ id: 'src1', columns: [] }] },
      },
      assertions: [
        { path: 'postExecutionChecks.length', gte: 4 },
      ],
    },
  ],
});
