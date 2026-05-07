/**
 * Tests for the Out of Scope prompt — prd.out_of_scope
 */

import { describe, it, expect } from 'vitest';

import { OutOfScopeContentSchema } from '../types.js';
import { createOutOfScopePrompt } from './out-of-scope.prompt.js';
import {
  makeSuccessAiPort,
  makeMalformedAiPort,
  makeFailingAiPort,
  makeIntentBrief,
  makeFunctionalRequirementsContent,
} from './test-helpers.js';

// ── Valid output fixture ───────────────────────────────────────────────────────

const VALID_OUTPUT = {
  items: [
    {
      id: 'OOS-1',
      description: 'New customer account registration and onboarding flow',
      rationale:
        'New registration requires identity verification, payment setup, and contract workflows that constitute a separate project. Customer acquisition is handled by the Sales team process, not the self-service portal.',
      deferredTo: 'Phase 2',
    },
    {
      id: 'OOS-2',
      description: 'Internal admin panel for support staff',
      rationale:
        'An admin interface for support agents is a separate product with different access controls, workflows, and data models. Building it within this project would double the scope.',
      deferredTo: 'Admin Portal project',
    },
    {
      id: 'OOS-3',
      description: 'Payment processing and plan upgrades within the portal',
      rationale:
        'Payment handling requires PCI DSS compliance, fraud detection, and integration with payment processors that are not part of the current project mandate. The current billing system handles payment collection.',
    },
    {
      id: 'OOS-4',
      description: 'Native mobile applications (iOS and Android)',
      rationale:
        'Mobile native apps require separate development teams and platform-specific work. The portal will be built as a responsive web application accessible from mobile browsers, which satisfies the primary use cases.',
      deferredTo: 'v2.0',
    },
    {
      id: 'OOS-5',
      description: 'Advanced usage analytics and reporting dashboards',
      rationale:
        'The current scope covers basic usage display. Advanced analytics with custom reports, data exports, and trend analysis require a dedicated BI capability not available in this phase.',
      deferredTo: 'Phase 3',
    },
  ],
  notes:
    'Items OOS-1 and OOS-3 are explicitly listed in the intent brief out-of-scope. Items OOS-2, OOS-4, and OOS-5 are inferred from the in-scope functional requirements to prevent scope ambiguity.',
};

describe('createOutOfScopePrompt', () => {
  it('returns correct prompt metadata', () => {
    const prompt = createOutOfScopePrompt(makeSuccessAiPort(VALID_OUTPUT));
    expect(prompt.id).toBe('prd.out_of_scope');
    expect(prompt.version).toBe('1.0.0');
  });

  it('happy path: returns validated OutOfScopeContent', async () => {
    const prompt = createOutOfScopePrompt(makeSuccessAiPort(VALID_OUTPUT));
    const result = await prompt.run({
      intentBrief: makeIntentBrief(),
      functionalRequirements: makeFunctionalRequirementsContent(),
    });

    const parsed = OutOfScopeContentSchema.safeParse(result.output);
    expect(parsed.success).toBe(true);

    expect(result.output.items.length).toBeGreaterThanOrEqual(2);
    expect(result.output.notes).toBeDefined();
  });

  it('every item has a non-empty rationale', async () => {
    const prompt = createOutOfScopePrompt(makeSuccessAiPort(VALID_OUTPUT));
    const result = await prompt.run({
      intentBrief: makeIntentBrief(),
      functionalRequirements: makeFunctionalRequirementsContent(),
    });

    for (const item of result.output.items) {
      expect(item.description.length).toBeGreaterThan(0);
      expect(item.rationale.length).toBeGreaterThan(0);
    }
  });

  it('throws after retries on malformed JSON', async () => {
    const prompt = createOutOfScopePrompt(makeMalformedAiPort());
    await expect(
      prompt.run(
        {
          intentBrief: makeIntentBrief(),
          functionalRequirements: makeFunctionalRequirementsContent(),
        },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow();
  });

  it('throws when AI port fails', async () => {
    const prompt = createOutOfScopePrompt(makeFailingAiPort());
    await expect(
      prompt.run(
        {
          intentBrief: makeIntentBrief(),
          functionalRequirements: makeFunctionalRequirementsContent(),
        },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow();
  });

  it('schema allows empty items array (no out-of-scope items is valid)', async () => {
    // OutOfScopeContentSchema does not require min(1) on items
    const minimal = { items: [] };
    const prompt = createOutOfScopePrompt(makeSuccessAiPort(minimal));
    const result = await prompt.run(
      {
        intentBrief: makeIntentBrief(),
        functionalRequirements: makeFunctionalRequirementsContent(),
      },
      { maxRetries: 0 },
    );
    expect(result.output.items).toHaveLength(0);
  });

  it('schema rejects item with missing rationale', async () => {
    const bad = {
      items: [
        {
          id: 'OOS-1',
          description: 'New registration',
          // missing rationale
        },
      ],
    };
    const prompt = createOutOfScopePrompt(makeSuccessAiPort(bad));
    await expect(
      prompt.run(
        {
          intentBrief: makeIntentBrief(),
          functionalRequirements: makeFunctionalRequirementsContent(),
        },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow(/Schema validation failed/);
  });
});
