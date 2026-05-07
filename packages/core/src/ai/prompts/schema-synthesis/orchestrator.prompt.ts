import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const inputs = z.object({
  prdSummary: z.string(),
  projectType: z.string(),
  databaseDriver: z.enum(['postgres', 'mssql', 'mongo']),
  capabilities: z.record(z.boolean()),
  existingTableCount: z.number().default(0),
  feedback: z.string().optional(),
});

const outputs = z.object({
  synthesisStrategy: z.string(),
  priorityEntities: z.array(z.string()),
  specialConsiderations: z.array(z.string()),
  reasoning: z.string(),
});

export const orchestratorPrompt = definePrompt({
  id: 'schema-synthesis.orchestrator',
  version: '1.0.0',
  description: 'Plan the schema synthesis strategy from PRD and capabilities',
  inputs,
  outputs,
  modelConfig: { provider: 'anthropic',
 model: 'claude-opus-4-7', maxTokens: 2048, temperature: 0.2 },
  systemPrompt: `You are a database architect. Plan the schema synthesis: which entities to prioritize, how to handle relationships for the chosen database, and any special considerations (high-cardinality tables, PII-heavy domains, existing schema constraints). Output a synthesis strategy that subsequent prompts will execute.`,
  userPromptTemplate: `PRD summary: {{prdSummary}}
Project type: {{projectType}}
Database: {{databaseDriver}}
Capabilities: {{capabilities}}
Existing tables: {{existingTableCount}}
{{#if feedback}}Feedback: {{feedback}}{{/if}}

Plan the schema synthesis strategy.`,
  tests: [
    {
      name: 'produces synthesis strategy',
      input: {
        prdSummary: 'A CRM with contacts, deals, and activity tracking',
        projectType: 'CRM', databaseDriver: 'postgres',
        capabilities: { arrayColumns: true, jsonColumns: true, foreignKeysEnforced: true }, existingTableCount: 0,
      },
      assertions: [
        (output: z.infer<typeof outputs>) => output.priorityEntities.length >= 2,
        (output: z.infer<typeof outputs>) => output.synthesisStrategy.length > 30,
      ],
    },
  ],
});

registerPrompt(orchestratorPrompt);
