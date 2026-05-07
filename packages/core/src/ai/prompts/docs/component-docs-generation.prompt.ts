import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const inputs = z.object({
  componentName: z.string(),
  componentSource: z.string().describe('TypeScript/TSX source or component interface definition'),
  screenshot: z.string().optional().describe('Base64 encoded screenshot of the component'),
  audience: z.enum(['developer', 'end_user']).default('developer'),
});

const outputs = z.object({
  title: z.string(),
  description: z.string(),
  sections: z.array(z.object({
    heading: z.string(),
    content: z.string(),
  })),
  propsTable: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
    default: z.string().optional(),
    description: z.string(),
  })).optional(),
  usageExample: z.string().describe('JSX usage example'),
  reasoning: z.object({
    highlightedBehaviors: z.string(),
    accessibilityNotes: z.string(),
  }),
});

export const componentDocsGenerationPrompt = definePrompt({
  id: 'docs.component-docs-generation',
  version: '1.0.0',
  description: 'Generate component reference documentation from TSX source or component interface',
  inputs,
  outputs,
  modelConfig: { provider: 'anthropic',
 model: 'claude-opus-4-7',
    maxTokens: 2500,
    temperature: 0.2,
  },
  systemPrompt: `You are a React component documentation specialist. Document UI components thoroughly
but concisely:

- Props table is mandatory for developer-audience pages
- Include keyboard navigation and accessibility notes where apparent from the source
- Usage example must be a minimal, realistic JSX snippet
- End-user audience: describe what the component does for the user, not its props
- Highlight any important behavioral notes (loading states, error states, empty states)
- Use <Callout type="warning"> for any footguns or gotchas`,

  userPromptTemplate: `Document the {{componentName}} React component.

Audience: {{audience}}

Component source:
\`\`\`tsx
{{componentSource}}
\`\`\`

{{#if screenshot}}
A screenshot is provided for reference.
{{/if}}

Generate a complete documentation page including a props table (for developer audience)
and a realistic usage example.`,

  tests: [
    {
      description: 'extracts props table from TypeScript interface',
      input: {
        componentName: 'ContactsTable',
        componentSource: 'interface Props { contacts: Contact[]; onSelect?: (id: string) => void; }',
        audience: 'developer',
      },
      assertions: [
        { type: 'output_present', path: 'propsTable' },
        { type: 'output_present', path: 'usageExample' },
      ],
    },
  ],
});
