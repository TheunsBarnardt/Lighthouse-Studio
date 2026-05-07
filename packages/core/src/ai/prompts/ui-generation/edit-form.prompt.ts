import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  entity: z.object({
    name: z.string(),
    tableName: z.string(),
    columns: z.array(z.object({ name: z.string(), type: z.string(), nullable: z.boolean(), isForeignKey: z.boolean() })),
    permissions: z.array(z.string()),
  }),
  sdkNamespace: z.string(),
});

const OutputSchema = z.object({
  componentCode: z.string(),
  storyCode: z.string(),
  reasoning: z.string(),
});

export const editFormPrompt = definePrompt({
  id: 'ui-generation.edit-form',
  version: '1.0.0',
  description: 'Generate an edit form component for a schema entity (pre-populated, with optimistic concurrency)',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { model: 'claude-opus-4-7', maxTokens: 4000, temperature: 0.2 },
  systemPrompt: `You generate a React edit form component using react-hook-form + zod.

Differences from create form:
- Pre-populates from existing record (loaded via SDK)
- Passes _version for optimistic concurrency check
- On version conflict (409): shows "This record was updated elsewhere; reload to see changes"
- Uses SDK update mutation
- Cancel button returns to detail view without saving
- Accessible, Tailwind, TypeScript strict`,
  userPromptTemplate: `Entity: {{entity.name}} (table: {{entity.tableName}})
SDK namespace: {{sdkNamespace}}

Columns: {{#each entity.columns}}{{this.name}} ({{this.type}}, {{#if this.nullable}}optional{{else}}required{{/if}}{{#if this.isForeignKey}}, FK{{/if}}); {{/each}}

Generate the edit form and Storybook story.`,
  tests: [
    {
      description: 'Generates edit contact form with version field',
      input: {
        entity: {
          name: 'Contact',
          tableName: 'contacts',
          columns: [{ name: 'email', type: 'text', nullable: false, isForeignKey: false }],
          permissions: ['contact.update'],
        },
        sdkNamespace: 'crm',
      },
      assertions: [
        { path: 'componentCode', contains: '_version' },
      ],
    },
  ],
});
