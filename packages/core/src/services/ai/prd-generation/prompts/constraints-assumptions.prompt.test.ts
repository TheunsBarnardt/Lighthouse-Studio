/**
 * Tests for the Constraints and Assumptions prompt — prd.constraints_and_assumptions
 */

import { describe, it, expect } from 'vitest';

import { ConstraintsAndAssumptionsContentSchema } from '../types.js';
import { createConstraintsAssumptionsPrompt } from './constraints-assumptions.prompt.js';
import {
  makeSuccessAiPort,
  makeMalformedAiPort,
  makeFailingAiPort,
  makeIntentBrief,
} from './test-helpers.js';

// ── Valid output fixture ───────────────────────────────────────────────────────

const VALID_OUTPUT = {
  constraints: [
    {
      id: 'con-1',
      type: 'technical',
      description: 'Must integrate with existing SSO via SAML 2.0',
      impact:
        'Authentication cannot be implemented independently. The portal must delegate all login flows to the existing SAML identity provider. Custom credential storage is prohibited.',
    },
    {
      id: 'con-2',
      type: 'regulatory',
      description: 'Must comply with GDPR for EU customers',
      impact:
        'Personal data handling must include explicit consent, right-to-erasure workflows, and data residency controls. A GDPR Data Processing Agreement with EU customers must be in place before launch.',
    },
    {
      id: 'con-3',
      type: 'technical',
      description:
        'Must support modern browsers only: Chrome 110+, Firefox 115+, Safari 16+, Edge 110+',
      impact:
        'No IE11 or legacy browser support. Some CSS features and JavaScript APIs can be used without polyfills.',
    },
  ],
  assumptions: [
    {
      id: 'ass-1',
      description: 'All customers already have active accounts in the existing system',
      riskIfWrong:
        'If any prospective users do not have existing accounts, a registration flow is required. This is currently out of scope and would require a separate project, potentially delaying launch by 4-6 weeks.',
    },
    {
      id: 'ass-2',
      description:
        'The SAML SSO integration is stable and available during the development and launch phases',
      riskIfWrong:
        'If the identity provider is unavailable or changes its API, all authentication testing will be blocked. An alternative mock IdP for development will need to be provisioned as a contingency.',
    },
    {
      id: 'ass-3',
      description:
        'The email delivery service can handle the expected volume of password reset emails',
      riskIfWrong:
        'If delivery rates are too low (high bounce or spam rates), password reset will be unreliable, making a core feature non-functional for a subset of users.',
    },
  ],
  dependencies: [
    'SAML 2.0 Identity Provider (existing SSO infrastructure)',
    'Email delivery service (SendGrid or equivalent)',
    'Existing billing and accounts system (REST API v3)',
    'GDPR legal review and DPA process',
  ],
};

describe('createConstraintsAssumptionsPrompt', () => {
  it('returns correct prompt metadata', () => {
    const prompt = createConstraintsAssumptionsPrompt(makeSuccessAiPort(VALID_OUTPUT));
    expect(prompt.id).toBe('prd.constraints_and_assumptions');
    expect(prompt.version).toBe('1.0.0');
  });

  it('happy path: returns validated ConstraintsAndAssumptionsContent', async () => {
    const prompt = createConstraintsAssumptionsPrompt(makeSuccessAiPort(VALID_OUTPUT));
    const result = await prompt.run({ intentBrief: makeIntentBrief() });

    const parsed = ConstraintsAndAssumptionsContentSchema.safeParse(result.output);
    expect(parsed.success).toBe(true);

    expect(result.output.constraints.length).toBeGreaterThanOrEqual(2);
    expect(result.output.assumptions.length).toBeGreaterThanOrEqual(2);
    expect(result.output.dependencies.length).toBeGreaterThanOrEqual(1);
  });

  it('every constraint has a non-empty impact field', async () => {
    const prompt = createConstraintsAssumptionsPrompt(makeSuccessAiPort(VALID_OUTPUT));
    const result = await prompt.run({ intentBrief: makeIntentBrief() });

    for (const constraint of result.output.constraints) {
      expect(constraint.impact.length).toBeGreaterThan(0);
      expect(constraint.description.length).toBeGreaterThan(0);
    }
  });

  it('every assumption has a non-empty riskIfWrong field', async () => {
    const prompt = createConstraintsAssumptionsPrompt(makeSuccessAiPort(VALID_OUTPUT));
    const result = await prompt.run({ intentBrief: makeIntentBrief() });

    for (const assumption of result.output.assumptions) {
      expect(assumption.riskIfWrong.length).toBeGreaterThan(0);
    }
  });

  it('throws after retries on malformed JSON', async () => {
    const prompt = createConstraintsAssumptionsPrompt(makeMalformedAiPort());
    await expect(
      prompt.run({ intentBrief: makeIntentBrief() }, { maxRetries: 0 }),
    ).rejects.toThrow();
  });

  it('throws when AI port fails', async () => {
    const prompt = createConstraintsAssumptionsPrompt(makeFailingAiPort());
    await expect(
      prompt.run({ intentBrief: makeIntentBrief() }, { maxRetries: 0 }),
    ).rejects.toThrow();
  });

  it('schema rejects constraint with missing impact', async () => {
    const bad = {
      constraints: [
        {
          id: 'con-1',
          type: 'technical',
          description: 'Must use existing SSO',
          // missing impact
        },
      ],
      assumptions: [],
      dependencies: [],
    };
    const prompt = createConstraintsAssumptionsPrompt(makeSuccessAiPort(bad));
    await expect(prompt.run({ intentBrief: makeIntentBrief() }, { maxRetries: 0 })).rejects.toThrow(
      /Schema validation failed/,
    );
  });
});
