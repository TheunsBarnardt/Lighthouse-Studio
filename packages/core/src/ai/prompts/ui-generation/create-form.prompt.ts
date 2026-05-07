import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  entity: z.object({
    name: z.string(),
    tableName: z.string(),
    columns: z.array(z.object({ name: z.string(), type: z.string(), nullable: z.boolean(), maxLength: z.number().optional(), isForeignKey: z.boolean(), referencedTable: z.string().optional(), isFile: z.boolean().optional() })),
    permissions: z.array(z.string()),
  }),
  sdkNamespace: z.string(),
});

const OutputSchema = z.object({
  componentCode: z.string(),
  zodSchemaCode: z.string(),
  storyCode: z.string(),
  reasoning: z.string(),
});

export const createFormPrompt = definePrompt({
  id: 'ui-generation.create-form',
  version: '1.0.0',
  description: 'Generate a create form component for a schema entity',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { provider: 'anthropic',
 model: 'claude-opus-4-7', maxTokens: 4000, temperature: 0.2 },
  systemPrompt: `You generate a React create form component for a schema entity using react-hook-form + zod.

Requirements:
- Separate zod schema file (can be reused server-side)
- react-hook-form + zodResolver
- Schema-driven: required, maxLength, type match column constraints
- FK columns: combobox search-as-you-type
- File columns: tus.io upload via SDK storage client
- Date columns: date picker
- Boolean columns: toggle/checkbox
- Number columns: number input
- Validation messages in plain English
- On submit: call SDK insert mutation; navigate to detail view on success
- Error handling: show API errors in form
- Accessible: labels, error messages with aria-describedby
- Tailwind + TypeScript strict`,
  userPromptTemplate: `Entity: {{entity.name}} (table: {{entity.tableName}})
SDK namespace: {{sdkNamespace}}

Columns: {{#each entity.columns}}{{this.name}} ({{this.type}}, {{#if this.nullable}}optional{{else}}required{{/if}}{{#if this.maxLength}}, maxLen={{this.maxLength}}{{/if}}{{#if this.isForeignKey}}, FK→{{this.referencedTable}}{{/if}}{{#if this.isFile}}, FILE{{/if}}); {{/each}}

Generate the create form, zod schema, and Storybook story.`,
  tests: [
    {
      description: 'Generates create contact form',
      input: {
        entity: {
          name: 'Contact',
          tableName: 'contacts',
          columns: [
            { name: 'full_name', type: 'text', nullable: false, isForeignKey: false },
            { name: 'email', type: 'text', nullable: false, isForeignKey: false },
          ],
          permissions: ['contact.create'],
        },
        sdkNamespace: 'crm',
      },
      assertions: [
        { path: 'componentCode', contains: 'react-hook-form' },
        { path: 'zodSchemaCode', contains: 'z.object' },
      ],
    },
  ],
});
