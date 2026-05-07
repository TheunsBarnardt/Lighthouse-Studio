import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  sourceColumn: z.object({
    name: z.string(),
    type: z.string(),
    sampleValues: z.array(z.unknown()),
  }),
  targetColumn: z.object({
    name: z.string(),
    type: z.string(),
    nullable: z.boolean(),
  }),
  context: z.string().optional(),
});

const OutputSchema = z.object({
  transformations: z.array(z.object({
    type: z.string(),
    parameters: z.record(z.unknown()),
    customExpression: z.string().optional(),
  })),
  notes: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  reasoning: z.string(),
});

export const transformationSuggestionPrompt = definePrompt({
  id: 'data-migration.transformation-suggestion',
  version: '1.0.0',
  description: 'Suggest transformation chain for a type/format mismatch between source and target column',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { provider: 'anthropic',
 model: 'claude-haiku-4-5-20251001',
    maxTokens: 1000,
    temperature: 0.1,
  },
  systemPrompt: `You suggest minimal transformation chains to convert source column values to target column format.

Prefer built-in transformations over custom JS expressions. Only suggest js_expression when no built-in handles the case.

Built-in transformations:
- trim, lowercase, uppercase, capitalize, slugify, regex_replace, regex_extract, split, join, substring, pad, mask
- parse_int, parse_float, round, multiply, divide, add, subtract
- parse_date (with format hints), format_date, add_days, to_unix_timestamp
- parse_bool
- parse_json, format_json, extract_path
- lookup_in_table, resolve_by_natural_key
- if_null, if_empty, default_if

Capture concise reasoning.`,
  userPromptTemplate: `Source column: {{sourceColumn.name}} ({{sourceColumn.type}})
Sample values: {{JSON.stringify sourceColumn.sampleValues}}

Target column: {{targetColumn.name}} ({{targetColumn.type}}, {{#if targetColumn.nullable}}nullable{{else}}required{{/if}})

{{#if context}}Context: {{context}}{{/if}}

Suggest the transformation chain.`,
  tests: [
    {
      description: 'Suggests parse_date for varchar date column to timestamptz',
      input: {
        sourceColumn: { name: 'created_date', type: 'varchar', sampleValues: ['2024-01-15', '2023-12-31'] },
        targetColumn: { name: 'created_at', type: 'timestamptz', nullable: false },
      },
      assertions: [
        { path: 'transformations.0.type', equals: 'parse_date' },
      ],
    },
  ],
});
