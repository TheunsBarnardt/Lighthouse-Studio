import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  prdContent: z.string(),
  brandName: z.string().optional(),
  brandPrimary: z.string().optional(),
  availableBlocks: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    region: z.string(),
    params: z.array(z.object({ name: z.string(), type: z.string(), description: z.string() })),
  })),
});

const OutputSchema = z.object({
  suggestedLayout: z.enum(['sidenav-with-topbar', 'topnav-only', 'full-page']),
  header: z.object({ blockId: z.string(), params: z.record(z.unknown()), reasoning: z.string() }),
  sidenav: z.object({ blockId: z.string(), params: z.record(z.unknown()), reasoning: z.string() }).optional(),
  breadcrumb: z.object({ blockId: z.string(), params: z.record(z.unknown()), reasoning: z.string() }).optional(),
  footer: z.object({ blockId: z.string(), params: z.record(z.unknown()), reasoning: z.string() }).optional(),
  pageOverrides: z.array(z.object({
    pageId: z.string(),
    pagePath: z.string(),
    layout: z.string().optional(),
    header: z.string().optional(),
    sidenav: z.string().optional(),
    breadcrumb: z.string().optional(),
    footer: z.string().optional(),
  })),
  overallReasoning: z.string(),
});

const prompt = definePrompt({
  id: 'app-chrome/chrome-proposal',
  version: '1.0.0',
  description: 'Propose an App Chrome configuration (layout, chrome blocks, page overrides) from a PRD and brand identity.',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { provider: 'anthropic',
 model: 'claude-haiku-4-5-20251001',
    maxTokens: 2000,
    temperature: 0.2,
  },
  systemPrompt: `You are an expert UI designer specialising in application chrome — the shared header, side navigation, breadcrumb, and footer that surround every page.

Given a product requirements document and available chrome blocks, you propose the best chrome configuration for the app.

Rules:
- Choose 'sidenav-with-topbar' for data-heavy apps (CRMs, dashboards, admin tools).
- Choose 'topnav-only' for consumer-facing or marketing-heavy apps.
- Always propose a header and footer. Sidenav and breadcrumb are optional.
- Sign-in, sign-up, and forgot-password pages MUST have a page override that sets sidenav: 'none', breadcrumb: 'none', and layout: 'topnav-only' or a minimal header.
- Set product name, logo, and nav items based on entities mentioned in the PRD.
- Return valid JSON matching the output schema.`,
  userPromptTemplate: `PRD:
{{prdContent}}

Brand name: {{brandName ?? 'the product'}}
Brand primary colour: {{brandPrimary ?? 'not specified'}}

Available chrome blocks:
{{availableBlocks | json}}

Propose the best App Chrome configuration. Return JSON only.`,
  tests: [
    {
      name: 'proposes sidenav for CRM PRD',
      input: {
        prdContent: 'A CRM for managing contacts, deals, and pipeline stages.',
        brandName: 'SalesCo',
        brandPrimary: '#2563EB',
        availableBlocks: [],
      },
      assertions: [
        { type: 'output_field_matches', field: 'suggestedLayout', value: 'sidenav-with-topbar' },
      ],
    },
  ],
});

registerPrompt(prompt);
export default prompt;
