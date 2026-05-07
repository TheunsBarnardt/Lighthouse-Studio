import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  appName: z.string(),
  entities: z.array(z.object({ name: z.string(), tableName: z.string(), hasCount: z.boolean() })),
  prdContext: z.string(),
  sdkNamespace: z.string(),
  designTokens: z.object({ primaryColor: z.string() }),
});

const OutputSchema = z.object({
  componentCode: z.string(),
  storyCode: z.string(),
  reasoning: z.string(),
});

export const dashboardComponentPrompt = definePrompt({
  id: 'ui-generation.dashboard-component',
  version: '1.0.0',
  description: 'Generate a dashboard page with stats cards and recent activity',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { provider: 'anthropic',
 model: 'claude-opus-4-7', maxTokens: 4000, temperature: 0.2 },
  systemPrompt: `You generate a React dashboard page.

Standard dashboard layout:
- Stats row: count cards per primary entity (e.g., "Total Contacts: 1,247")
- Recent activity: last N records per entity with created_at
- Quick actions: primary call-to-action buttons (Create Contact, Create Deal)
- Welcome message with user's name from SDK auth

Uses SDK to fetch counts and recent records.
Accessible, responsive (grid → stack on mobile), Tailwind + TypeScript strict.`,
  userPromptTemplate: `App: {{appName}}
SDK namespace: {{sdkNamespace}}
Primary color: {{designTokens.primaryColor}}

Entities with counts:
{{#each entities}}{{#if this.hasCount}}- {{this.name}} (table: {{this.tableName}})
{{/if}}{{/each}}

PRD context: {{prdContext}}

Generate the dashboard component and Storybook story.`,
  tests: [
    {
      description: 'Generates CRM dashboard with stats',
      input: {
        appName: 'CRM',
        sdkNamespace: 'crm',
        entities: [{ name: 'Contact', tableName: 'contacts', hasCount: true }, { name: 'Deal', tableName: 'deals', hasCount: true }],
        prdContext: 'CRM for sales teams',
        designTokens: { primaryColor: '#3B82F6' },
      },
      assertions: [
        { path: 'componentCode', contains: 'Contact' },
      ],
    },
  ],
});
