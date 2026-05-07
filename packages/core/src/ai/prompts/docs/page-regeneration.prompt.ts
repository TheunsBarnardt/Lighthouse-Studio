import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const inputs = z.object({
  pageTitle: z.string(),
  currentContent: z.string().describe('Existing MDX content of the page'),
  updatedSource: z.string().describe('The updated source artifact that triggered regeneration'),
  sourceType: z.string(),
  changeDescription: z.string().optional().describe('Human-readable description of what changed in the source'),
  humanEditedSections: z.array(z.string()).optional().describe('Section headings that were manually edited and should be preserved'),
});

const outputs = z.object({
  updatedSections: z.array(z.object({
    heading: z.string(),
    content: z.string(),
    changed: z.boolean(),
  })),
  preservedSections: z.array(z.string()).describe('Headings of sections that were kept unchanged'),
  changesSummary: z.string().describe('Brief description of what was regenerated and why'),
  reasoning: z.object({
    diffStrategy: z.string(),
    humanEditConservation: z.string(),
  }),
});

export const pageRegenerationPrompt = definePrompt({
  id: 'docs.page-regeneration',
  version: '1.0.0',
  description: 'Regenerate specific sections of a documentation page in response to a source change, preserving human edits',
  inputs,
  outputs,
  modelConfig: { provider: 'anthropic',
 model: 'claude-opus-4-7',
    maxTokens: 3000,
    temperature: 0.1,
  },
  systemPrompt: `You are a documentation maintainer performing targeted updates. Rules:
- Only update sections that are directly affected by the source change
- Preserve human-edited sections verbatim unless the source change contradicts them
- When a human edit conflicts with the new source, update the content but add a
  <Callout type="warning">This section was manually edited and may need review.</Callout>
- Mark each output section with changed: true/false
- The changes summary should be concise (1-2 sentences)`,

  userPromptTemplate: `Update the documentation page "{{pageTitle}}" in response to a change in its {{sourceType}} source.

{{#if changeDescription}}Change: {{changeDescription}}{{/if}}

Current page content:
\`\`\`mdx
{{currentContent}}
\`\`\`

Updated source:
\`\`\`
{{updatedSource}}
\`\`\`

{{#if humanEditedSections}}
Preserve these manually edited sections unchanged (unless directly contradicted by the source):
{{humanEditedSections}}
{{/if}}

Update only the sections that need to change. Return all sections, marking each as changed or unchanged.`,

  tests: [
    {
      description: 'preserves human-edited sections during regeneration',
      input: {
        pageTitle: 'Contact Entity',
        currentContent: '## Fields\n| Field | Type |\n|---|---|\n| id | uuid |\n\n## Customization\nOur team uses tags for segmentation.',
        updatedSource: JSON.stringify({ entity: 'Contact', fields: [{ name: 'id', type: 'uuid' }, { name: 'tags', type: 'string[]' }] }),
        sourceType: 'schema',
        changeDescription: 'Added tags field',
        humanEditedSections: ['Customization'],
      },
      assertions: [
        { type: 'output_present', path: 'updatedSections' },
        { type: 'output_contains', path: 'preservedSections', value: 'Customization' },
      ],
    },
  ],
});
