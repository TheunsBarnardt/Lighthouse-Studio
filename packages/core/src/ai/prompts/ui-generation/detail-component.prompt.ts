import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  entity: z.object({
    name: z.string(),
    tableName: z.string(),
    columns: z.array(z.object({ name: z.string(), type: z.string(), nullable: z.boolean(), isForeignKey: z.boolean(), referencedTable: z.string().optional(), piiCategory: z.string().optional() })),
    permissions: z.array(z.string()),
  }),
  designTokens: z.object({ primaryColor: z.string(), fontFamily: z.string() }),
  sdkNamespace: z.string(),
  realtimeEnabled: z.boolean(),
});

const OutputSchema = z.object({
  componentCode: z.string(),
  storyCode: z.string(),
  reasoning: z.string(),
});

export const detailComponentPrompt = definePrompt({
  id: 'ui-generation.detail-component',
  version: '1.0.0',
  description: 'Generate a detail/record view component for a schema entity',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { provider: 'anthropic',
 model: 'claude-opus-4-7', maxTokens: 4000, temperature: 0.2 },
  systemPrompt: `You generate a React detail view component for a schema entity.

Requirements:
- Fetch a single record by ID using SDK
- Display all columns with appropriate renderers (date formatting, FK resolution, file previews, PII redaction)
- Edit and Delete buttons (permission-aware)
- Back button to list view
- FK columns: click-to-navigate to related record detail
- File/image columns: inline preview
- PII columns: redacted if user lacks pii.read permission
- Real-time updates via SDK realtime (if enabled)
- Accessible: heading hierarchy, landmarks, keyboard navigation
- Tailwind + TypeScript strict`,
  userPromptTemplate: `Entity: {{entity.name}} (table: {{entity.tableName}})
SDK namespace: {{sdkNamespace}}
Real-time: {{realtimeEnabled}}

Columns: {{#each entity.columns}}{{this.name}} ({{this.type}}{{#if this.isForeignKey}}, FK→{{this.referencedTable}}{{/if}}{{#if this.piiCategory}}, PII={{this.piiCategory}}{{/if}}); {{/each}}

Permissions: {{entity.permissions.join ", "}}

Generate the detail component and Storybook story.`,
  tests: [
    {
      description: 'Generates contact detail component',
      input: {
        entity: {
          name: 'Contact',
          tableName: 'contacts',
          columns: [
            { name: 'id', type: 'uuid', nullable: false, isForeignKey: false },
            { name: 'email', type: 'text', nullable: false, isForeignKey: false, piiCategory: 'email' },
          ],
          permissions: ['contact.read', 'contact.update'],
        },
        designTokens: { primaryColor: '#3B82F6', fontFamily: 'Inter' },
        sdkNamespace: 'crm',
        realtimeEnabled: false,
      },
      assertions: [
        { path: 'componentCode', contains: 'useQuery' },
      ],
    },
  ],
});
