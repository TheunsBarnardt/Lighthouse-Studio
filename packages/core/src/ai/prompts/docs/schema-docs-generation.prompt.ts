import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const inputs = z.object({
  sourceType: z.enum(['schema', 'api_rest', 'api_graphql', 'ui_component', 'webhook_config', 'auth_config']),
  sourceContent: z.string().describe('JSON or MDX source artifact to document'),
  entityName: z.string().optional().describe('Primary entity name for page title generation'),
  audience: z.enum(['developer', 'end_user']).default('developer'),
});

const outputs = z.object({
  title: z.string().describe('Page title'),
  description: z.string().describe('One-sentence description for meta/SEO'),
  sections: z.array(z.object({
    heading: z.string(),
    content: z.string().describe('MDX content for this section'),
  })).describe('Ordered documentation sections'),
  reasoning: z.object({
    structureRationale: z.string(),
    audienceAdaptations: z.string(),
  }),
});

export const schemaDocsGenerationPrompt = definePrompt({
  id: 'docs.schema-page-generation',
  version: '1.0.0',
  description: 'Generate an MDX documentation page from a schema entity, API spec, or UI component definition',
  inputs,
  outputs,
  modelConfig: { provider: 'anthropic',
 model: 'claude-opus-4-7',
    maxTokens: 3000,
    temperature: 0.2,
  },
  systemPrompt: `You are a technical documentation specialist. Generate clear, accurate MDX documentation
from structured source artifacts. Follow these principles:

- **Developer audience**: precise, implementation-focused, shows types and examples
- **End-user audience**: task-oriented ("How do I…"), avoids implementation jargon
- Always include a practical usage example in a code block where relevant
- Tables are preferred over bullet lists for structured data (fields, properties, endpoints)
- Each section heading should be sentence-case
- Do not include boilerplate like "Introduction" or "Overview" as section headings — use descriptive headings
- MDX callouts use the syntax: <Callout type="info">…</Callout>`,

  userPromptTemplate: `Generate documentation for the following {{sourceType}} artifact.

Audience: {{audience}}
{{#if entityName}}Entity name: {{entityName}}{{/if}}

Source:
\`\`\`
{{sourceContent}}
\`\`\`

Produce a complete MDX documentation page with a title, description, and ordered sections.
Capture your reasoning about structure choices and any audience adaptations you made.`,

  tests: [
    {
      description: 'generates schema entity docs with field table',
      input: {
        sourceType: 'schema',
        sourceContent: JSON.stringify({ entity: 'Contact', fields: [{ name: 'id', type: 'uuid', required: true }, { name: 'email', type: 'string', required: true }] }),
        entityName: 'Contact',
        audience: 'developer',
      },
      assertions: [
        { type: 'output_contains', path: 'title', value: 'Contact' },
        { type: 'output_present', path: 'sections' },
        { type: 'output_contains', path: 'sections[0].content', value: 'email' },
      ],
    },
  ],
});
