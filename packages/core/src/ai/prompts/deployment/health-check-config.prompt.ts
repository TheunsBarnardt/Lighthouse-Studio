import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

export const healthCheckConfigPrompt = definePrompt({
  id: 'deployment/health-check-config',
  version: '1.0.0',
  description: 'Derive health check endpoints from the deployed UI routes and server functions',
  inputs: z.object({
    uiRoutes: z.array(z.string()),
    serverFunctions: z.array(z.object({ name: z.string(), path: z.string(), method: z.string() })),
    appVersion: z.string(),
  }),
  outputs: z.object({
    endpoints: z.array(z.object({
      path: z.string(),
      method: z.string(),
      expectedStatus: z.number(),
      description: z.string(),
      critical: z.boolean(),
    })),
    timeoutSeconds: z.number(),
    rationale: z.string(),
  }),
  modelConfig: { provider: 'anthropic',
 model: 'claude-haiku-4-5', maxTokens: 1000, temperature: 0.1 },
  systemPrompt: `Derive health check endpoints for post-deployment verification.
Always include:
- /api/health (critical: true) — standard health endpoint
- / (UI root, critical: true) — verifies UI is serving
- One representative server function endpoint (critical: false) — functional check
Keep the list short (3-5 endpoints). Timeout: 60s default.
Output ONLY valid JSON.`,
  userPromptTemplate: `UI routes: {{uiRoutes}}
Server functions: {{serverFunctions}}
App version: {{appVersion}}

Derive minimal health check endpoints for post-deployment verification.`,
  tests: [],
});
