import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

export const signalDeduplicationPrompt = definePrompt({
  id: 'maintenance/signal-deduplication',
  version: '1.0.0',
  description: 'Identify whether an incoming signal is a duplicate of an existing one',
  inputs: z.object({
    incomingSignal: z.record(z.unknown()),
    existingSignals: z.array(z.record(z.unknown())),
  }),
  outputs: z.object({
    isDuplicate: z.boolean(),
    duplicateOfSignalId: z.string().optional(),
    confidence: z.number().min(0).max(1),
    cluster: z.string().optional(),
    reasoning: z.string(),
  }),
  modelConfig: { provider: 'anthropic',
 model: 'claude-haiku-4-5', maxTokens: 800, temperature: 0.1 },
  systemPrompt: `Determine if an incoming signal is a duplicate of existing signals.
Signals are duplicates if they represent the same underlying issue (same error, same endpoint, same root cause).
They may differ in exact message or timestamp while still being the same issue.
A "cluster" name groups related signals (e.g., "ContactsList-null-error" for all null-pointer errors in that component).
Output ONLY valid JSON.`,
  userPromptTemplate: `Incoming signal:
{{incomingSignal}}

Existing signals:
{{existingSignals}}

Is this a duplicate? Which existing signal (if any) does it duplicate?`,
  tests: [],
});
