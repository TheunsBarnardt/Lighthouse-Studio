import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  pages: z.array(z.object({ id: z.string(), path: z.string(), pageType: z.string(), title: z.string(), permissions: z.array(z.any()) })),
  authPages: z.array(z.object({ path: z.string(), type: z.string() })),
});

const OutputSchema = z.object({
  routerCode: z.string(),
  reasoning: z.string(),
});

export const routingConfigPrompt = definePrompt({
  id: 'ui-generation.routing-config',
  version: '1.0.0',
  description: 'Generate React Router v6 routing configuration from the information architecture',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { model: 'claude-haiku-4-5-20251001', maxTokens: 2000, temperature: 0.1 },
  systemPrompt: `You generate a React Router v6 routing configuration.

Use createBrowserRouter with route objects.
Protected routes wrapped with AuthGuard.
Lazy-loaded page components using React.lazy + Suspense.
404 page for unmatched routes.
TypeScript strict.`,
  userPromptTemplate: `Pages: {{#each pages}}{{this.path}} ({{this.pageType}}), {{/each}}
Auth pages: {{#each authPages}}{{this.path}}, {{/each}}

Generate the router configuration.`,
  tests: [
    {
      description: 'Generates router with lazy-loaded routes',
      input: {
        pages: [{ id: 'p1', path: '/contacts', pageType: 'list', title: 'Contacts', permissions: [] }],
        authPages: [{ path: '/sign-in', type: 'sign_in' }],
      },
      assertions: [
        { path: 'routerCode', contains: 'createBrowserRouter' },
      ],
    },
  ],
});
