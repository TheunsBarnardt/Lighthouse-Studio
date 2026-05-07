import { z } from 'zod';
import { definePrompt, registerPrompt } from '../registry.js';

const inputs = z.object({
  prdContent: z.string(),
  projectType: z.string(),
  targetUsers: z.string(),
});

const outputs = z.object({
  entities: z.array(z.object({
    name: z.string(),
    description: z.string(),
    suggestedTableName: z.string(),
    attributes: z.array(z.string()),
    prdReferences: z.array(z.string()),
  })),
  relationships: z.array(z.object({
    from: z.string(),
    to: z.string(),
    type: z.enum(['one-to-one', 'one-to-many', 'many-to-many']),
    description: z.string(),
    prdReferences: z.array(z.string()),
  })),
  ambiguitiesFlagged: z.array(z.string()),
  reasoning: z.string(),
});

export const entityExtractionPrompt = definePrompt({
  id: 'schema-synthesis.entity-extraction',
  version: '1.0.0',
  description: 'Extract database entities and relationships from a PRD',
  inputs,
  outputs,
  modelConfig: { model: 'claude-opus-4-7', maxTokens: 4096, temperature: 0.2 },
  systemPrompt: `You are a data modeling expert. Extract persistent domain entities and their relationships from a Product Requirements Document. Focus on nouns that represent data that needs to be stored. Use snake_case plural for table names (users, posts, comments). Identify all relationships and flag any ambiguous cases for user confirmation.`,
  userPromptTemplate: `PRD content: {{prdContent}}
Project type: {{projectType}}
Target users: {{targetUsers}}

Extract all database entities (tables), their attributes, and relationships. For each entity, list the PRD sections that reference it.`,
  tests: [
    {
      name: 'extracts entities from CRM PRD',
      input: { prdContent: 'Users can manage contacts. Each contact has a name, email, and phone. Contacts belong to deals. Deals track value, stage, and close date.', projectType: 'CRM', targetUsers: 'Sales teams' },
      assertions: [
        (output: z.infer<typeof outputs>) => output.entities.length >= 3,
        (output: z.infer<typeof outputs>) => output.entities.some(e => e.suggestedTableName.includes('contact')),
        (output: z.infer<typeof outputs>) => output.relationships.length >= 1,
      ],
    },
  ],
});

registerPrompt(entityExtractionPrompt);
