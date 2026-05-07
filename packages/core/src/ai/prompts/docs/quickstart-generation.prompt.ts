import { z } from 'zod';
import { definePrompt } from '../define-prompt.js';

const inputs = z.object({
  appName: z.string(),
  appPurpose: z.string().describe('One-sentence description of what the app does'),
  primaryEntities: z.array(z.string()).describe('Main domain entities, e.g. ["Contact", "Deal", "Note"]'),
  authMethod: z.string().describe('E.g. "API key", "OAuth 2.0", "session cookie"'),
  audience: z.enum(['developer', 'end_user']).default('developer'),
  apiBaseUrl: z.string().optional(),
});

const outputs = z.object({
  title: z.string(),
  sections: z.array(z.object({
    heading: z.string(),
    content: z.string(),
  })),
  estimatedReadingMinutes: z.number(),
  reasoning: z.object({
    narrativeFlow: z.string(),
    audienceAssumptions: z.string(),
  }),
});

export const quickstartGenerationPrompt = definePrompt({
  id: 'docs.quickstart-generation',
  version: '1.0.0',
  description: 'Generate a getting-started guide tailored to the app and its target audience',
  inputs,
  outputs,
  modelConfig: {
    model: 'claude-opus-4-7',
    maxTokens: 3000,
    temperature: 0.3,
  },
  systemPrompt: `You are a technical writer creating getting-started guides. Rules:
- Developer audience: start with auth, then first API call, then a common workflow
- End-user audience: start with logging in, then the first task they will perform
- Numbered steps for sequential actions; prose for conceptual context
- Include a "what you'll build" section to set expectations
- Each step should be completable in under 5 minutes of the reader's time
- Code examples must be complete and copy-pasteable
- End with a "What's next" section linking to related docs pages`,

  userPromptTemplate: `Generate a quickstart guide for {{appName}}.

App purpose: {{appPurpose}}
Primary entities: {{primaryEntities}}
Authentication: {{authMethod}}
Audience: {{audience}}
{{#if apiBaseUrl}}API base URL: {{apiBaseUrl}}{{/if}}

Create a complete, actionable getting-started guide. Estimate reading time.`,

  tests: [
    {
      description: 'generates developer quickstart with auth step',
      input: {
        appName: 'CRM Pro',
        appPurpose: 'Manage contacts and deals for a sales team',
        primaryEntities: ['Contact', 'Deal'],
        authMethod: 'API key',
        audience: 'developer',
        apiBaseUrl: 'https://api.crm.example.com/v1',
      },
      assertions: [
        { type: 'output_present', path: 'sections' },
        { type: 'output_range', path: 'estimatedReadingMinutes', min: 2, max: 10 },
      ],
    },
  ],
});
