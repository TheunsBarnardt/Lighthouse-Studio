/**
 * Tests for the Target Users and Personas prompt — prd.target_users_and_personas
 */

import { describe, it, expect } from 'vitest';

import { TargetUsersContentSchema } from '../types.js';
import { createTargetUsersPersonasPrompt } from './target-users-personas.prompt.js';
import {
  makeSuccessAiPort,
  makeMalformedAiPort,
  makeFailingAiPort,
  makeIntentBrief,
  makeOverviewContent,
} from './test-helpers.js';

// ── Valid output fixture ───────────────────────────────────────────────────────

const VALID_OUTPUT = {
  personas: [
    {
      id: 'persona-1',
      name: 'Enterprise Account Manager',
      description:
        'A business professional responsible for managing multiple sub-accounts under an enterprise contract.',
      primaryGoals: [
        'Access a consolidated view of all sub-accounts without calling support',
        'Download invoices for accounting purposes',
        'Manage user access within the enterprise account',
      ],
      painPoints: [
        'Must submit a support ticket for every account change, taking 2-3 business days',
        'No real-time visibility into team usage and limits',
        'Invoice retrieval requires a manual request to the billing team',
      ],
      technicalProficiency: 'medium',
      frequency: 'weekly',
      tracesTo: [
        {
          type: 'intent_brief',
          artifactId: 'pipeline-test-001',
          fieldPath: 'targetUsers.persona-1',
        },
      ],
    },
    {
      id: 'persona-2',
      name: 'Individual Customer',
      description:
        'A non-technical consumer customer with a single account needing basic self-service.',
      primaryGoals: [
        'Reset password without waiting for support',
        'Update contact information independently',
      ],
      painPoints: ['Email support takes 2-5 days to respond', 'No way to self-serve basic changes'],
      technicalProficiency: 'low',
      frequency: 'monthly',
      tracesTo: [
        {
          type: 'intent_brief',
          artifactId: 'pipeline-test-001',
          fieldPath: 'targetUsers.persona-2',
        },
      ],
    },
  ],
  primaryPersona: 'persona-1',
  marketSize: 'Approximately 12,000 enterprise accounts and 85,000 individual accounts',
};

describe('createTargetUsersPersonasPrompt', () => {
  it('returns correct prompt metadata', () => {
    const prompt = createTargetUsersPersonasPrompt(makeSuccessAiPort(VALID_OUTPUT));
    expect(prompt.id).toBe('prd.target_users_and_personas');
    expect(prompt.version).toBe('1.0.0');
  });

  it('happy path: returns validated TargetUsersContent', async () => {
    const prompt = createTargetUsersPersonasPrompt(makeSuccessAiPort(VALID_OUTPUT));
    const result = await prompt.run({
      intentBrief: makeIntentBrief(),
      overview: makeOverviewContent(),
    });

    const parsed = TargetUsersContentSchema.safeParse(result.output);
    expect(parsed.success).toBe(true);

    expect(result.output.personas).toHaveLength(2);
    const firstPersona = result.output.personas[0];
    expect(firstPersona).toBeDefined();
    expect(firstPersona!.id).toBe('persona-1');
    expect(firstPersona!.primaryGoals.length).toBeGreaterThanOrEqual(2);
    expect(firstPersona!.painPoints.length).toBeGreaterThanOrEqual(2);
    expect(result.output.primaryPersona).toBe('persona-1');
    expect(result.output.marketSize).toBeDefined();
  });

  it('each persona has at least one tracesTo ref', async () => {
    const prompt = createTargetUsersPersonasPrompt(makeSuccessAiPort(VALID_OUTPUT));
    const result = await prompt.run({
      intentBrief: makeIntentBrief(),
      overview: makeOverviewContent(),
    });

    for (const persona of result.output.personas) {
      expect(persona.tracesTo.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('throws after retries when model returns malformed JSON', async () => {
    const prompt = createTargetUsersPersonasPrompt(makeMalformedAiPort());
    await expect(
      prompt.run(
        { intentBrief: makeIntentBrief(), overview: makeOverviewContent() },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow();
  });

  it('throws when AI port fails', async () => {
    const prompt = createTargetUsersPersonasPrompt(makeFailingAiPort());
    await expect(
      prompt.run(
        { intentBrief: makeIntentBrief(), overview: makeOverviewContent() },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow();
  });

  it('schema rejects output with empty personas array', async () => {
    const bad = { personas: [], primaryPersona: 'persona-1' };
    const prompt = createTargetUsersPersonasPrompt(makeSuccessAiPort(bad));
    await expect(
      prompt.run(
        { intentBrief: makeIntentBrief(), overview: makeOverviewContent() },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow(/Schema validation failed/);
  });
});
