import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  componentName: z.string(),
  componentCode: z.string(),
  componentType: z.string(),
  entityName: z.string().optional(),
});

const OutputSchema = z.object({
  storyCode: z.string(),
  reasoning: z.string(),
});

export const storybookStoryPrompt = definePrompt({
  id: 'ui-generation.storybook-story',
  version: '1.0.0',
  description: 'Generate a Storybook story file for a generated component',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { model: 'claude-haiku-4-5-20251001', maxTokens: 2000, temperature: 0.15 },
  systemPrompt: `You generate a Storybook CSF3 story file for a React component.

Include:
- Default story with realistic mock data
- Empty/loading state story where applicable
- Error state story where applicable
- Mock SDK responses via msw handlers or decorators

Use @storybook/react and @storybook/addon-interactions.
TypeScript; proper Meta and StoryObj types.`,
  userPromptTemplate: `Component: {{componentName}} (type: {{componentType}}{{#if entityName}}, entity: {{entityName}}{{/if}})

Component code:
{{componentCode}}

Generate the Storybook story.`,
  tests: [
    {
      description: 'Generates story with default and empty states',
      input: {
        componentName: 'ContactList',
        componentType: 'list',
        entityName: 'Contact',
        componentCode: `export function ContactList() { return <div>contacts</div>; }`,
      },
      assertions: [
        { path: 'storyCode', contains: 'ContactList' },
      ],
    },
  ],
});
