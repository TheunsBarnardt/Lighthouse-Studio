import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const EnvironmentConfigSchema = z.object({
  name: z.string(),
  autoDeploy: z.boolean(),
  testsRequired: z.boolean(),
  approvers: z.array(z.string()),
  approvalMode: z.enum(['any_of', 'all_of']),
  deployMode: z.enum(['rolling', 'blue_green']),
  healthCheck: z.object({
    timeoutSeconds: z.number(),
    endpoints: z.array(z.string()),
    expectedStatus: z.number().optional(),
  }),
  notificationChannels: z.array(z.string()),
});

export const deploymentPlanGenerationPrompt = definePrompt({
  id: 'deployment/deployment-plan-generation',
  version: '1.0.0',
  description: 'Generate a deployment plan from approved artifacts across the workspace environments',
  inputs: z.object({
    projectId: z.string(),
    uiProjectId: z.string(),
    serverCodeProjectId: z.string(),
    schemaId: z.string(),
    testSuiteId: z.string(),
    appVersion: z.string(),
  }),
  outputs: z.object({
    environments: z.array(EnvironmentConfigSchema),
    schemaMigrations: z.array(z.object({
      sequence: z.number(),
      direction: z.enum(['forward', 'reverse']),
      reversible: z.boolean(),
      reasoning: z.string(),
    })),
    irreversibleOperations: z.array(z.object({
      description: z.string(),
      migrationSequence: z.number(),
      warning: z.string(),
    })),
    globalConfig: z.object({
      rollbackRetentionDays: z.number(),
      healthCheckTimeoutSeconds: z.number(),
      notificationChannels: z.array(z.string()),
    }),
    reasoning: z.object({
      overallApproach: z.string(),
      environmentProgressionRationale: z.string(),
      schemaStrategyRationale: z.string(),
      riskAssessment: z.string(),
    }),
  }),
  modelConfig: { provider: 'anthropic',
 model: 'claude-haiku-4-5', maxTokens: 3000, temperature: 0.2 },
  systemPrompt: `You are a senior DevOps architect generating a deployment plan for an AI-generated application.
Standard environment progression: dev (auto-deploy, no tests required) → staging (workspace_admin approval, tests required) → prod (architect+owner approval, tests required, blue_green for zero-downtime).
Rules:
- Identify any destructive schema migrations and flag them as irreversible operations
- Recommend rolling deploy for dev/staging; blue_green for prod is the default
- Health check endpoints should include /api/health and the UI root /
- Global rollback retention: 7 days
- Output ONLY valid JSON matching the schema`,
  userPromptTemplate: `Project ID: {{projectId}}
App Version: {{appVersion}}
UI Project: {{uiProjectId}}
Server Code: {{serverCodeProjectId}}
Schema: {{schemaId}}
Test Suite: {{testSuiteId}}

Generate a deployment plan with per-environment configuration. Identify schema migration order and flag any irreversible operations.`,
  tests: [],
});
