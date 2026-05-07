/**
 * Tests for the Open Questions prompt — prd.open_questions
 */

import { describe, it, expect } from 'vitest';

import { OpenQuestionsContentSchema } from '../types.js';
import { createOpenQuestionsPrompt } from './open-questions.prompt.js';
import {
  makeSuccessAiPort,
  makeMalformedAiPort,
  makeFailingAiPort,
  makeIntentBrief,
  makeFunctionalRequirementsContent,
  makeNonFunctionalRequirementsContent,
} from './test-helpers.js';

// ── Valid output fixture ───────────────────────────────────────────────────────

const VALID_OUTPUT = {
  questions: [
    {
      id: 'OQ-1',
      question:
        'What is the token expiry duration for password reset links — 30 minutes or 24 hours?',
      context:
        'FR-3 specifies a 30-minute expiry for reset links. Some stakeholders have requested 24 hours for customers in low-connectivity regions. The choice affects security posture (shorter = more secure) vs. usability (longer = better for slow email delivery). This must be resolved before FR-3 acceptance criteria are finalised.',
      owner: 'Product manager and security architect',
      status: 'open',
      impact: 'blocking',
    },
    {
      id: 'OQ-2',
      question:
        'Will the portal need to display sub-account data for accounts with more than 500 sub-accounts?',
      context:
        'FR-1 describes a consolidated dashboard but does not cap the number of sub-accounts. Enterprise customers with 500+ sub-accounts will generate significant data loads. The answer determines whether pagination, lazy loading, or virtual scrolling is required in the FR-1 design, which affects NFR-1 performance targets.',
      owner: 'Product manager',
      status: 'open',
      impact: 'high',
    },
    {
      id: 'OQ-3',
      question:
        'Does GDPR compliance require a cookie consent banner on the portal, and if so, which categories of cookies will be used?',
      context:
        'CON-2 specifies GDPR compliance for EU customers. The current NFRs do not address cookie policy. If analytics or session cookies are used beyond strictly necessary, a consent banner is legally required. This affects the frontend implementation and may require a Consent Management Platform.',
      owner: 'Legal team',
      status: 'open',
      impact: 'high',
    },
    {
      id: 'OQ-4',
      question:
        'Is there a requirement to support single sign-out (SLO) alongside SAML SSO sign-in?',
      context:
        'CON-1 requires SAML 2.0 SSO for authentication. SAML SLO (Single Log-Out) is optional in the specification but may be required by the enterprise customer security policy. Without SLO, logging out of the portal does not terminate the IdP session. This needs confirmation before the authentication FR is accepted.',
      owner: 'Security architect',
      status: 'open',
      impact: 'medium',
    },
    {
      id: 'OQ-5',
      question: 'What is the target language/localisation scope for the portal at launch?',
      context:
        'The intent brief does not specify languages. If EU customers are targeted (implied by GDPR constraint), French, German, or other EU languages may be required. Localisation affects content structure, UI layout, and testing effort. If multi-language is needed, it should be scoped in this phase rather than retrofitted.',
      owner: 'Product manager',
      status: 'open',
      impact: 'medium',
    },
  ],
};

describe('createOpenQuestionsPrompt', () => {
  it('returns correct prompt metadata', () => {
    const prompt = createOpenQuestionsPrompt(makeSuccessAiPort(VALID_OUTPUT));
    expect(prompt.id).toBe('prd.open_questions');
    expect(prompt.version).toBe('1.0.0');
  });

  it('happy path: returns validated OpenQuestionsContent', async () => {
    const prompt = createOpenQuestionsPrompt(makeSuccessAiPort(VALID_OUTPUT));
    const result = await prompt.run({
      intentBrief: makeIntentBrief(),
      functionalRequirements: makeFunctionalRequirementsContent(),
      nonFunctionalRequirements: makeNonFunctionalRequirementsContent(),
    });

    const parsed = OpenQuestionsContentSchema.safeParse(result.output);
    expect(parsed.success).toBe(true);

    expect(result.output.questions.length).toBeGreaterThanOrEqual(3);
  });

  it('all questions have valid impact and status values', async () => {
    const validImpacts = ['blocking', 'high', 'medium', 'low'];
    const validStatuses = ['open', 'resolved', 'deferred'];

    const prompt = createOpenQuestionsPrompt(makeSuccessAiPort(VALID_OUTPUT));
    const result = await prompt.run({
      intentBrief: makeIntentBrief(),
      functionalRequirements: makeFunctionalRequirementsContent(),
      nonFunctionalRequirements: makeNonFunctionalRequirementsContent(),
    });

    for (const q of result.output.questions) {
      expect(validImpacts).toContain(q.impact);
      expect(validStatuses).toContain(q.status);
      expect(q.question.length).toBeGreaterThan(0);
      expect(q.context.length).toBeGreaterThan(0);
    }
  });

  it('throws after retries on malformed JSON', async () => {
    const prompt = createOpenQuestionsPrompt(makeMalformedAiPort());
    await expect(
      prompt.run(
        {
          intentBrief: makeIntentBrief(),
          functionalRequirements: makeFunctionalRequirementsContent(),
          nonFunctionalRequirements: makeNonFunctionalRequirementsContent(),
        },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow();
  });

  it('throws when AI port fails', async () => {
    const prompt = createOpenQuestionsPrompt(makeFailingAiPort());
    await expect(
      prompt.run(
        {
          intentBrief: makeIntentBrief(),
          functionalRequirements: makeFunctionalRequirementsContent(),
          nonFunctionalRequirements: makeNonFunctionalRequirementsContent(),
        },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow();
  });

  it('schema allows empty questions array', async () => {
    const minimal = { questions: [] };
    const prompt = createOpenQuestionsPrompt(makeSuccessAiPort(minimal));
    const result = await prompt.run(
      {
        intentBrief: makeIntentBrief(),
        functionalRequirements: makeFunctionalRequirementsContent(),
        nonFunctionalRequirements: makeNonFunctionalRequirementsContent(),
      },
      { maxRetries: 0 },
    );
    expect(result.output.questions).toHaveLength(0);
  });

  it('schema rejects question with invalid impact value', async () => {
    const bad = {
      questions: [
        {
          id: 'OQ-1',
          question: 'A question',
          context: 'Some context',
          status: 'open',
          impact: 'critical', // not a valid value in the schema
        },
      ],
    };
    const prompt = createOpenQuestionsPrompt(makeSuccessAiPort(bad));
    await expect(
      prompt.run(
        {
          intentBrief: makeIntentBrief(),
          functionalRequirements: makeFunctionalRequirementsContent(),
          nonFunctionalRequirements: makeNonFunctionalRequirementsContent(),
        },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow(/Schema validation failed/);
  });
});
