import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  prdSummary: z.string(),
  functionalRequirements: z.array(z.string()),
  userStories: z.array(z.string()),
  entities: z.array(z.object({ name: z.string(), tableName: z.string(), columns: z.array(z.string()) })),
  appName: z.string(),
});

const OutputSchema = z.object({
  pages: z.array(z.object({
    id: z.string(),
    path: z.string(),
    title: z.string(),
    pageType: z.enum(['list', 'detail', 'create', 'edit', 'workflow', 'dashboard', 'custom']),
    primaryEntity: z.string().optional(),
    permissions: z.array(z.object({ action: z.string(), required: z.boolean() })),
    realtimeEnabled: z.boolean(),
    tracesTo: z.array(z.object({ prdSectionId: z.string(), requirementId: z.string() })),
    reasoning: z.string(),
  })),
  navigation: z.object({
    type: z.enum(['sidebar', 'topbar', 'both']),
    items: z.array(z.any()),
    userMenuItems: z.array(z.any()),
  }),
  authPages: z.array(z.object({ id: z.string(), path: z.string(), type: z.string() })),
  globalLayouts: z.array(z.object({ id: z.string(), name: z.string(), type: z.string(), slots: z.array(z.string()) })),
  reasoning: z.string(),
});

export const informationArchitecturePrompt = definePrompt({
  id: 'ui-generation.information-architecture',
  version: '1.0.0',
  description: 'Extract information architecture (pages, routes, navigation) from PRD and schema',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { model: 'claude-opus-4-7', maxTokens: 4000, temperature: 0.2 },
  systemPrompt: `You extract the information architecture for a web application from a PRD and schema.

Generate a complete page list with routes, types, entities, permissions, and navigation structure.

Standard patterns:
- Each primary entity gets: list (/entities), create (/entities/new), detail (/entities/:id), edit (/entities/:id/edit)
- Dashboard at / for authenticated users
- Auth pages: /sign-in, /sign-up, /forgot-password
- Settings at /settings
- Sidebar navigation for data-heavy apps; topbar for simpler apps

Permissions: reference the action names from the schema (e.g. "contact.read", "contact.create").
Real-time: enable for entities used in collaborative workflows.
Trace pages back to PRD requirements.`,
  userPromptTemplate: `App: {{appName}}

PRD summary: {{prdSummary}}

User stories:
{{#each userStories}}- {{this}}
{{/each}}

Functional requirements:
{{#each functionalRequirements}}- {{this}}
{{/each}}

Schema entities:
{{#each entities}}- {{this.name}} (table: {{this.tableName}}, columns: {{this.columns.join ", "}})
{{/each}}

Generate the complete information architecture.`,
  tests: [
    {
      description: 'Generates standard CRUD pages for a CRM',
      input: {
        appName: 'CRM',
        prdSummary: 'A CRM for managing contacts and deals',
        userStories: ['As a sales rep, I want to view all my contacts', 'As a sales rep, I want to create a new deal'],
        functionalRequirements: ['Contact management', 'Deal tracking'],
        entities: [
          { name: 'Contact', tableName: 'contacts', columns: ['id', 'full_name', 'email'] },
          { name: 'Deal', tableName: 'deals', columns: ['id', 'title', 'value', 'contact_id'] },
        ],
      },
      assertions: [
        { path: 'pages.length', gte: 4 },
      ],
    },
  ],
});
