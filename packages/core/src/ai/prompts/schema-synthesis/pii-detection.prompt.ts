import { z } from 'zod';
import { definePrompt, registerPrompt } from '../registry.js';

const inputs = z.object({
  tables: z.array(z.object({
    id: z.string(),
    name: z.string(),
    columns: z.array(z.object({ id: z.string(), name: z.string(), type: z.string(), description: z.string() })),
  })),
  domainContext: z.string(),
});

const outputs = z.object({
  detections: z.array(z.object({
    tableId: z.string(),
    columnId: z.string(),
    columnName: z.string(),
    categories: z.array(z.string()),
    reasoning: z.string(),
    confidence: z.enum(['high', 'medium', 'low']),
  })),
  reasoning: z.string(),
});

const PII_HEURISTIC_NAMES = ['email', 'phone', 'name', 'address', 'birth', 'ssn', 'tax_id', 'credit_card', 'passport', 'national_id', 'ip_address', 'location', 'gender', 'ethnicity', 'salary', 'bank_account'];

export const piiDetectionPrompt = definePrompt({
  id: 'schema-synthesis.pii-detection',
  version: '1.0.0',
  description: 'Detect PII columns in synthesized tables',
  inputs,
  outputs,
  modelConfig: { model: 'claude-haiku-4-5-20251001', maxTokens: 2048, temperature: 0.1 },
  systemPrompt: `Identify columns containing Personal Identifiable Information. Consider context: "name" in a users table is PII; "name" in a tags table is not. Categories: name, email, phone, address, national_id, financial, health, biometric, behavioral. Flag with confidence levels. Heuristic patterns: ${PII_HEURISTIC_NAMES.join(', ')}.`,
  userPromptTemplate: `Tables and columns: {{tables}}
Domain context: {{domainContext}}

Identify all PII columns with reasoning and confidence level.`,
  tests: [
    {
      name: 'detects PII in users table',
      input: {
        tables: [{ id: 'tbl_users', name: 'users', columns: [{ id: 'col_email', name: 'email', type: 'text', description: 'User email' }, { id: 'col_created', name: 'created_at', type: 'timestamp', description: 'Creation time' }] }],
        domainContext: 'CRM for sales teams',
      },
      assertions: [
        (output: z.infer<typeof outputs>) => output.detections.some(d => d.columnName === 'email'),
        (output: z.infer<typeof outputs>) => !output.detections.some(d => d.columnName === 'created_at'),
      ],
    },
  ],
});

registerPrompt(piiDetectionPrompt);
