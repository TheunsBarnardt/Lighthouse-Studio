import { z } from 'zod';
import { definePrompt } from '../define-prompt.js';

const inputs = z.object({
  apiSpec: z.string().describe('OpenAPI 3.x JSON or GraphQL SDL string'),
  apiType: z.enum(['rest', 'graphql']),
  appName: z.string(),
  baseUrl: z.string().optional(),
});

const outputs = z.object({
  title: z.string(),
  description: z.string(),
  sections: z.array(z.object({
    heading: z.string(),
    content: z.string(),
    endpointGroup: z.string().optional(),
  })),
  quickstartExample: z.string().describe('A cURL or JS fetch example for the most common operation'),
  reasoning: z.object({
    groupingStrategy: z.string(),
    exampleSelection: z.string(),
  }),
});

export const apiDocsGenerationPrompt = definePrompt({
  id: 'docs.api-docs-generation',
  version: '1.0.0',
  description: 'Generate REST or GraphQL API reference documentation from an OpenAPI spec or SDL',
  inputs,
  outputs,
  modelConfig: {
    model: 'claude-opus-4-7',
    maxTokens: 4000,
    temperature: 0.1,
  },
  systemPrompt: `You are an API documentation expert. Generate comprehensive API reference pages from
OpenAPI 3.x specs or GraphQL SDL. Follow these conventions:

- Group endpoints by resource (not by HTTP method)
- For each endpoint: method + path as heading, description, request params table, response schema, example
- For GraphQL: group queries/mutations by domain, show input types and return types
- Include authentication requirements for each endpoint/operation
- Use language-specific code tabs when showing examples (cURL, JavaScript, Python)
- HTTP status codes should be in a table with description`,

  userPromptTemplate: `Generate a complete API reference documentation page for {{appName}}.

API type: {{apiType}}
{{#if baseUrl}}Base URL: {{baseUrl}}{{/if}}

Specification:
\`\`\`
{{apiSpec}}
\`\`\`

Include a practical quickstart example showing the most common operation a developer would perform.
Explain your grouping strategy and example selection in the reasoning field.`,

  tests: [
    {
      description: 'groups REST endpoints by resource',
      input: {
        apiSpec: JSON.stringify({ openapi: '3.0.0', paths: { '/contacts': { get: { summary: 'List contacts' }, post: { summary: 'Create contact' } } } }),
        apiType: 'rest',
        appName: 'My CRM',
        baseUrl: 'https://api.example.com/v1',
      },
      assertions: [
        { type: 'output_present', path: 'sections' },
        { type: 'output_present', path: 'quickstartExample' },
      ],
    },
  ],
});
