import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  prdContent: z.string(),
  schemaContent: z.string(),
  uiProjectSummary: z.string(),
  integrations: z.array(z.object({ id: z.string(), name: z.string(), description: z.string() })),
});

const FunctionSpecSchema = z.object({
  name: z.string(),
  triggerType: z.enum(['http', 'schedule', 'event', 'manual']),
  triggerConfig: z.record(z.unknown()),
  description: z.string(),
  inputs: z.array(z.object({ name: z.string(), type: z.string(), required: z.boolean() })),
  outputs: z.array(z.object({ name: z.string(), type: z.string(), required: z.boolean() })),
  requiredPermissions: z.array(z.string()),
  requiredSecrets: z.array(z.string()),
  requiredIntegrations: z.array(z.string()),
  estimatedComplexity: z.enum(['low', 'medium', 'high']),
  inferredFrom: z.enum(['ui_call', 'prd_requirement', 'integration', 'manual']),
  rationale: z.string(),
});

const OutputSchema = z.object({
  functions: z.array(FunctionSpecSchema),
  rationale: z.string(),
  inferredFromUi: z.array(z.string()),
  inferredFromPrd: z.array(z.string()),
  inferredFromIntegrations: z.array(z.string()),
  totalEstimatedCost: z.number(),
});

const prompt = definePrompt({
  id: 'code-generation/inventory-extraction',
  version: '1.0.0',
  description: 'Extract the minimal set of server functions needed by scanning the PRD, UI manifest, and schema.',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: {
    model: 'claude-opus-4-7',
    maxTokens: 4000,
    temperature: 0.1,
  },
  systemPrompt: `You are an expert backend architect extracting the minimal set of custom server functions needed for an application.

Key discipline: generate the FEWEST functions that satisfy the requirements. Auto-generated CRUD covers most data operations.

Only generate custom server functions for:
1. SDK calls in the UI to non-auto-generated endpoints (platform.functions.*)
2. PRD requirements using language like "the system should...", "when X happens...", "every day at..."
3. Integration adapters (Stripe, SendGrid, etc.) declared in the PRD

Triggers:
- 'http': request-response APIs, called by UI or external
- 'schedule': cron jobs ("every night at midnight", "weekly digest")
- 'event': triggered by platform events (row-changed, user-signed-up, file-uploaded)
- 'manual': admin-invoked operations

Return JSON only.`,
  userPromptTemplate: `PRD:
{{prdContent}}

Database schema (abbreviated):
{{schemaContent}}

UI project summary:
{{uiProjectSummary}}

Available integrations:
{{integrations | json}}

Extract the minimal function inventory. Aim for 5–15 functions maximum. Return JSON only.`,
  tests: [
    {
      name: 'CRM PRD produces deal scoring and notification functions',
      input: {
        prdContent: 'CRM that scores contacts by activity. When score exceeds 80, notify sales team via email.',
        schemaContent: 'contacts(id, email, score), deals(id, contact_id, amount)',
        uiProjectSummary: 'ContactsList, DealDetail pages calling platform.functions.updateContactScore',
        integrations: [{ id: 'sendgrid', name: 'SendGrid', description: 'Email delivery' }],
      },
      assertions: [
        { type: 'output_field_min_items', field: 'functions', count: 1 },
        { type: 'output_field_includes_name', field: 'functions[].name', value: 'update_contact_score' },
      ],
    },
  ],
});

registerPrompt(prompt);
export default prompt;
