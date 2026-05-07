import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  userStory: z.string(),
  workflowTitle: z.string(),
  steps: z.array(z.object({ title: z.string(), description: z.string(), inputs: z.array(z.string()), actions: z.array(z.string()) })),
  sdkNamespace: z.string(),
  targetEntities: z.array(z.string()),
});

const OutputSchema = z.object({
  componentCode: z.string(),
  storyCode: z.string(),
  reasoning: z.string(),
});

export const workflowComponentPrompt = definePrompt({
  id: 'ui-generation.workflow-component',
  version: '1.0.0',
  description: 'Generate a multi-step workflow component from a PRD user story',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { model: 'claude-opus-4-7', maxTokens: 5000, temperature: 0.2 },
  systemPrompt: `You generate a multi-step workflow React component (wizard) for a user story.

Requirements:
- Step indicator showing current progress
- Each step has validation before proceeding
- State held in React useState / useReducer between steps
- Final step calls SDK action or mutation
- Cancel returns to previous page
- Accessible: step announcements via aria-live
- Tailwind + TypeScript strict`,
  userPromptTemplate: `User story: {{userStory}}
Workflow: {{workflowTitle}}
Target entities: {{targetEntities.join ", "}}
SDK namespace: {{sdkNamespace}}

Steps:
{{#each steps}}
Step {{@index + 1}}: {{this.title}}
Description: {{this.description}}
Inputs: {{this.inputs.join ", "}}
Actions: {{this.actions.join ", "}}
{{/each}}

Generate the workflow wizard component and Storybook story.`,
  tests: [
    {
      description: 'Generates CSV import wizard',
      input: {
        userStory: 'As a user, I want to import contacts from CSV',
        workflowTitle: 'Import Contacts from CSV',
        sdkNamespace: 'crm',
        targetEntities: ['contacts'],
        steps: [
          { title: 'Upload File', description: 'Choose a CSV file', inputs: ['file'], actions: [] },
          { title: 'Map Columns', description: 'Map CSV columns to contact fields', inputs: ['columnMappings'], actions: [] },
          { title: 'Import', description: 'Run the import', inputs: [], actions: ['import'] },
        ],
      },
      assertions: [
        { path: 'componentCode', contains: 'step' },
      ],
    },
  ],
});
