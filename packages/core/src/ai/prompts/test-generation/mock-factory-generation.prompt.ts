import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

export const mockFactoryGenerationPrompt = definePrompt({
  id: 'test-generation/mock-factory-generation',
  version: '1.0.0',
  description: 'Generate schema-aware mock factories for test data creation',
  inputs: z.object({
    schemaContent: z.string(),
    projectId: z.string(),
  }),
  outputs: z.object({
    source: z.string(),
    reasoning: z.object({
      whyThisTestExists: z.string(),
      whatItVerifies: z.string(),
      designDecisions: z.array(z.string()),
    }),
  }),
  modelConfig: { provider: 'anthropic',
 model: 'claude-haiku-4-5', maxTokens: 4000, temperature: 0.1 },
  systemPrompt: `You are an expert developer generating TypeScript mock factories for test data.
Rules:
- Generate one factory function per entity/table in the schema
- Use @faker-js/faker for realistic values where appropriate
- Each factory accepts a partial override: createUser(overrides?: Partial<User>): User
- Export all factories from the file
- Include relationship helpers (createUserWithPosts, etc.) for common associations
- Use strict TypeScript types derived from the schema
- Output ONLY valid JSON with 'source' and 'reasoning' fields`,
  userPromptTemplate: `Generate mock factories for this database schema:
{{schemaContent}}

Project ID: {{projectId}}

Create a comprehensive mock factory file covering all entities.`,
  tests: [],
});
