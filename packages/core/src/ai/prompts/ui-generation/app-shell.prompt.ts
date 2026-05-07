import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  appName: z.string(),
  navigation: z.object({
    type: z.enum(['sidebar', 'topbar', 'both']),
    items: z.array(z.any()),
    userMenuItems: z.array(z.any()),
  }),
  designTokens: z.object({ primaryColor: z.string(), fontFamily: z.string(), borderRadius: z.string() }),
  hasAuth: z.boolean(),
});

const OutputSchema = z.object({
  appShellCode: z.string(),
  navComponentCode: z.string(),
  authGuardCode: z.string(),
  reasoning: z.string(),
});

export const appShellPrompt = definePrompt({
  id: 'ui-generation.app-shell',
  version: '1.0.0',
  description: 'Generate the app shell: navigation, layout wrapper, auth guard',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { provider: 'anthropic',
 model: 'claude-opus-4-7', maxTokens: 4000, temperature: 0.2 },
  systemPrompt: `You generate the app shell for a React application.

Components to generate:
1. AppShell: wraps authenticated pages; includes navigation + content area
2. Navigation component (sidebar or topbar per navType): renders nav items; permission-aware (hides items user can't access)
3. AuthGuard: redirects unauthenticated users to /sign-in; wraps protected routes

Requirements:
- Uses SDK auth client for session state
- Responsive: sidebar collapses to mobile drawer
- Active nav item highlighted
- User menu: profile link, sign out
- Accessible: nav landmarks, skip-to-content link
- Tailwind + TypeScript strict`,
  userPromptTemplate: `App: {{appName}}
Nav type: {{navigation.type}}
Has auth: {{hasAuth}}

Navigation items:
{{#each navigation.items}}- {{this.label}} → {{this.path}}{{#if this.permission}} (requires {{this.permission}}){{/if}}
{{/each}}

Design: primary={{designTokens.primaryColor}}, font={{designTokens.fontFamily}}, radius={{designTokens.borderRadius}}

Generate AppShell, Navigation, and AuthGuard components.`,
  tests: [
    {
      description: 'Generates sidebar shell for CRM',
      input: {
        appName: 'CRM',
        navigation: { type: 'sidebar', items: [{ label: 'Contacts', path: '/contacts' }, { label: 'Deals', path: '/deals' }], userMenuItems: [] },
        designTokens: { primaryColor: '#3B82F6', fontFamily: 'Inter', borderRadius: '0.375rem' },
        hasAuth: true,
      },
      assertions: [
        { path: 'appShellCode', contains: 'AuthGuard' },
      ],
    },
  ],
});
