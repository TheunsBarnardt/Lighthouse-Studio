import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  entity: z.object({
    name: z.string(),
    tableName: z.string(),
    columns: z.array(z.object({ name: z.string(), type: z.string(), nullable: z.boolean(), isForeignKey: z.boolean(), referencedTable: z.string().optional() })),
    permissions: z.array(z.string()),
  }),
  designTokens: z.object({ primaryColor: z.string(), fontFamily: z.string(), borderRadius: z.string() }),
  sdkNamespace: z.string(),
  realtimeEnabled: z.boolean(),
  prdContext: z.string(),
});

const OutputSchema = z.object({
  componentCode: z.string(),
  storyCode: z.string(),
  reasoning: z.string(),
});

export const listComponentPrompt = definePrompt({
  id: 'ui-generation.list-component',
  version: '1.0.0',
  description: 'Generate a list/table component for a schema entity',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { provider: 'anthropic',
 model: 'claude-opus-4-7', maxTokens: 5000, temperature: 0.2 },
  systemPrompt: `You generate a React list/table component for a schema entity.

Requirements:
- Use TanStack Query for data fetching via the SDK
- Pagination with cursor-based navigation
- Column filtering and sorting
- Permission-aware: hide edit/delete buttons when user lacks permission
- Real-time updates via SDK realtime client (if realtimeEnabled)
- FK columns resolve to display names, not raw UUIDs
- Accessible: proper table semantics, keyboard navigation
- Tailwind CSS with design tokens
- TypeScript strict mode
- react-hook-form + zod for filter forms

Component structure:
\`\`\`tsx
'use client';
// imports
export function EntityList() { ... }
\`\`\`

Also generate a .stories.tsx file.
Capture reasoning.`,
  userPromptTemplate: `Entity: {{entity.name}} (table: {{entity.tableName}})
SDK namespace: {{sdkNamespace}}
Real-time: {{realtimeEnabled}}

Columns:
{{#each entity.columns}}- {{this.name}} ({{this.type}}, {{#if this.nullable}}nullable{{else}}required{{/if}}{{#if this.isForeignKey}}, FK→{{this.referencedTable}}{{/if}})
{{/each}}

Permissions: {{entity.permissions.join ", "}}
Design tokens: primary={{designTokens.primaryColor}}, font={{designTokens.fontFamily}}, radius={{designTokens.borderRadius}}

PRD context: {{prdContext}}

Generate the list component and its Storybook story.`,
  tests: [
    {
      description: 'Generates contacts list component',
      input: {
        entity: {
          name: 'Contact',
          tableName: 'contacts',
          columns: [
            { name: 'id', type: 'uuid', nullable: false, isForeignKey: false },
            { name: 'full_name', type: 'text', nullable: false, isForeignKey: false },
            { name: 'email', type: 'text', nullable: false, isForeignKey: false },
          ],
          permissions: ['contact.read', 'contact.update', 'contact.delete'],
        },
        designTokens: { primaryColor: '#3B82F6', fontFamily: 'Inter', borderRadius: '0.375rem' },
        sdkNamespace: 'crm',
        realtimeEnabled: true,
        prdContext: 'CRM contact management',
      },
      assertions: [
        { path: 'componentCode', contains: 'useQuery' },
      ],
    },
  ],
});
