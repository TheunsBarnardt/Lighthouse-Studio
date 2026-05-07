import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  currentMapping: z.any(),
  sourceDescription: z.any(),
  targetSchema: z.any(),
  userFeedback: z.string(),
  specificTable: z.string().optional(),
});

const OutputSchema = z.object({
  updatedTableMappings: z.array(z.any()),
  changes: z.array(z.string()),
  reasoning: z.string(),
});

export const regenerationPrompt = definePrompt({
  id: 'data-migration.regeneration',
  version: '1.0.0',
  description: 'Regenerate migration mapping with user feedback',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    model: 'claude-opus-4-7',
    maxTokens: 4000,
    temperature: 0.2,
  },
  systemPrompt: `You update a migration mapping plan based on user feedback.

Apply the user's instructions precisely. Preserve mappings not mentioned in the feedback.
If regenerating a specific table, only update that table's mappings.
List all changes made.`,
  userPromptTemplate: `User feedback: {{userFeedback}}

{{#if specificTable}}Regenerate only table: {{specificTable}}{{else}}Regenerate the full mapping.{{/if}}

Current mapping (abbreviated): {{JSON.stringify currentMapping}}

Apply the feedback and return the updated table mappings.`,
  tests: [
    {
      description: 'Applies user feedback to update a specific table mapping',
      input: {
        currentMapping: { tableMappings: [] },
        sourceDescription: { type: 'csv', tables: [] },
        targetSchema: { tables: [] },
        userFeedback: 'Map email column to user_email instead',
        specificTable: 'users',
      },
      assertions: [
        { path: 'changes.length', gte: 1 },
      ],
    },
  ],
});
