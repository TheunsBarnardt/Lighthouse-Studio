import { z } from 'zod';
import { definePrompt, registerPrompt } from '../registry.js';

const inputs = z.object({
  extractedEntities: z.array(z.object({ name: z.string(), suggestedTableName: z.string() })),
  generatedTables: z.array(z.object({ id: z.string(), name: z.string(), description: z.string() })),
  prdRequirements: z.array(z.object({ id: z.string(), description: z.string() })),
});

const outputs = z.object({
  prdEntitiesCovered: z.array(z.object({ entityName: z.string(), tableId: z.string() })),
  prdEntitiesUncovered: z.array(z.object({ entityName: z.string(), reason: z.string() })),
  prdRequirementsCovered: z.array(z.object({ requirementId: z.string(), supportingTableIds: z.array(z.string()) })),
  prdRequirementsUnsupported: z.array(z.object({ requirementId: z.string(), missingSchema: z.string() })),
  coverageRate: z.number().min(0).max(1),
  reasoning: z.string(),
});

export const coverageValidationPrompt = definePrompt({
  id: 'schema-synthesis.coverage-validation',
  version: '1.0.0',
  description: 'Validate that the synthesized schema covers all PRD entities and requirements',
  inputs,
  outputs,
  modelConfig: { model: 'claude-haiku-4-5-20251001', maxTokens: 2048, temperature: 0.1 },
  systemPrompt: `Verify that all entities and functional requirements from the PRD have corresponding schema support. Each extracted entity should have a corresponding table. Each functional requirement involving data storage or retrieval should have supporting tables/columns. Coverage gaps are warnings, not errors. Calculate coverage rate as (covered entities) / (total entities).`,
  userPromptTemplate: `Extracted entities: {{extractedEntities}}
Generated tables: {{generatedTables}}
PRD requirements: {{prdRequirements}}

Validate coverage and identify gaps.`,
  tests: [
    {
      name: 'computes coverage rate',
      input: {
        extractedEntities: [{ name: 'User', suggestedTableName: 'users' }, { name: 'Post', suggestedTableName: 'posts' }],
        generatedTables: [{ id: 'tbl_users', name: 'users', description: 'Users table' }],
        prdRequirements: [{ id: 'FR-1', description: 'Users can create posts' }],
      },
      assertions: [
        (output: z.infer<typeof outputs>) => output.coverageRate < 1.0,
        (output: z.infer<typeof outputs>) => output.prdEntitiesUncovered.length >= 1,
      ],
    },
  ],
});

registerPrompt(coverageValidationPrompt);
