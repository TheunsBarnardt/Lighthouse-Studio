/**
 * Tests for the Risks and Mitigations prompt — prd.risks_and_mitigations
 */

import { describe, it, expect } from 'vitest';

import { RisksAndMitigationsContentSchema } from '../types.js';
import { createRisksMitigationsPrompt } from './risks-mitigations.prompt.js';
import {
  makeSuccessAiPort,
  makeMalformedAiPort,
  makeFailingAiPort,
  makeIntentBrief,
  makeFunctionalRequirementsContent,
  makeNonFunctionalRequirementsContent,
  makeConstraintsAndAssumptionsContent,
} from './test-helpers.js';

// ── Valid output fixture ───────────────────────────────────────────────────────

const VALID_OUTPUT = {
  risks: [
    {
      id: 'RISK-1',
      title: 'SAML SSO Integration Instability',
      description:
        'The existing SAML 2.0 SSO provider may experience downtime or breaking API changes during development or after launch, rendering authentication non-functional for all users.',
      probability: 'medium',
      impact: 'critical',
      riskScore: 'high',
      mitigation:
        'Implement a mock SAML IdP for development to decouple from production SSO instability. Establish a formal SLA with the identity provider team before go-live. Build a circuit breaker with a graceful "SSO unavailable" error page.',
      contingency:
        'If SSO becomes unavailable in production, activate a break-glass emergency local login for admin accounts and communicate estimated recovery time to customers.',
      owner: 'Tech lead',
      relatedRequirements: ['NFR-2'],
    },
    {
      id: 'RISK-2',
      title: 'Scope Expansion Under Delivery Timeline',
      description:
        'Stakeholders may request additional features (registration, payments, admin panel) mid-project, expanding scope beyond what can be delivered in the agreed timeline.',
      probability: 'high',
      impact: 'high',
      riskScore: 'high',
      mitigation:
        'Establish a formal scope change control process before development begins. All requests outside the defined out-of-scope items require a written change request with impact assessment and approval from the product sponsor.',
      owner: 'Product manager',
    },
    {
      id: 'RISK-3',
      title: 'GDPR Non-Compliance at Launch',
      description:
        'EU customer data handling may not meet all GDPR requirements (consent management, right-to-erasure, data residency) by the planned launch date if legal review is delayed.',
      probability: 'medium',
      impact: 'critical',
      riskScore: 'high',
      mitigation:
        'Begin GDPR legal review at project kickoff, not at the end. Include data protection officer (DPO) sign-off as a launch gate. Implement right-to-erasure workflows in the first sprint.',
      contingency:
        'If GDPR compliance cannot be confirmed for EU customers by launch, exclude EU customer access until compliance is confirmed. Communicate to affected customers with a timeline.',
      owner: 'Legal team',
      relatedRequirements: ['NFR-2'],
    },
    {
      id: 'RISK-4',
      title: 'Dashboard Performance Degradation Under Load',
      description:
        'Enterprise customers with hundreds of sub-accounts may cause slow dashboard load times that violate NFR-1, reducing adoption and generating negative feedback.',
      probability: 'medium',
      impact: 'high',
      riskScore: 'high',
      mitigation:
        'Implement pagination and lazy loading for the account list from day one. Set up load testing with k6 against realistic enterprise account volumes (200+ sub-accounts) as part of the CI pipeline.',
      relatedRequirements: ['FR-1', 'NFR-1'],
    },
  ],
  overallRiskRating: 'high',
};

describe('createRisksMitigationsPrompt', () => {
  it('returns correct prompt metadata', () => {
    const prompt = createRisksMitigationsPrompt(makeSuccessAiPort(VALID_OUTPUT));
    expect(prompt.id).toBe('prd.risks_and_mitigations');
    expect(prompt.version).toBe('1.0.0');
  });

  it('happy path: returns validated RisksAndMitigationsContent', async () => {
    const prompt = createRisksMitigationsPrompt(makeSuccessAiPort(VALID_OUTPUT));
    const result = await prompt.run({
      intentBrief: makeIntentBrief(),
      functionalRequirements: makeFunctionalRequirementsContent(),
      nonFunctionalRequirements: makeNonFunctionalRequirementsContent(),
      constraintsAndAssumptions: makeConstraintsAndAssumptionsContent(),
    });

    const parsed = RisksAndMitigationsContentSchema.safeParse(result.output);
    expect(parsed.success).toBe(true);

    expect(result.output.risks.length).toBeGreaterThanOrEqual(3);
    expect(['low', 'medium', 'high', 'critical']).toContain(result.output.overallRiskRating);
  });

  it('every risk has a non-empty mitigation', async () => {
    const prompt = createRisksMitigationsPrompt(makeSuccessAiPort(VALID_OUTPUT));
    const result = await prompt.run({
      intentBrief: makeIntentBrief(),
      functionalRequirements: makeFunctionalRequirementsContent(),
      nonFunctionalRequirements: makeNonFunctionalRequirementsContent(),
      constraintsAndAssumptions: makeConstraintsAndAssumptionsContent(),
    });

    for (const risk of result.output.risks) {
      expect(risk.mitigation.length).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(risk.probability);
      expect(['low', 'medium', 'high', 'critical']).toContain(risk.impact);
      expect(['low', 'medium', 'high', 'critical']).toContain(risk.riskScore);
    }
  });

  it('throws after retries on malformed JSON', async () => {
    const prompt = createRisksMitigationsPrompt(makeMalformedAiPort());
    await expect(
      prompt.run(
        {
          intentBrief: makeIntentBrief(),
          functionalRequirements: makeFunctionalRequirementsContent(),
          nonFunctionalRequirements: makeNonFunctionalRequirementsContent(),
          constraintsAndAssumptions: makeConstraintsAndAssumptionsContent(),
        },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow();
  });

  it('throws when AI port fails', async () => {
    const prompt = createRisksMitigationsPrompt(makeFailingAiPort());
    await expect(
      prompt.run(
        {
          intentBrief: makeIntentBrief(),
          functionalRequirements: makeFunctionalRequirementsContent(),
          nonFunctionalRequirements: makeNonFunctionalRequirementsContent(),
          constraintsAndAssumptions: makeConstraintsAndAssumptionsContent(),
        },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow();
  });

  it('schema rejects risk with invalid riskScore', async () => {
    const bad = {
      risks: [
        {
          id: 'RISK-1',
          title: 'Some Risk',
          description: 'A risk exists.',
          probability: 'medium',
          impact: 'high',
          riskScore: 'extreme', // not a valid value
          mitigation: 'Do something.',
        },
      ],
      overallRiskRating: 'high',
    };
    const prompt = createRisksMitigationsPrompt(makeSuccessAiPort(bad));
    await expect(
      prompt.run(
        {
          intentBrief: makeIntentBrief(),
          functionalRequirements: makeFunctionalRequirementsContent(),
          nonFunctionalRequirements: makeNonFunctionalRequirementsContent(),
          constraintsAndAssumptions: makeConstraintsAndAssumptionsContent(),
        },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow(/Schema validation failed/);
  });

  it('schema allows risks array to be empty', async () => {
    const minimal = { risks: [], overallRiskRating: 'low' };
    const prompt = createRisksMitigationsPrompt(makeSuccessAiPort(minimal));
    const result = await prompt.run(
      {
        intentBrief: makeIntentBrief(),
        functionalRequirements: makeFunctionalRequirementsContent(),
        nonFunctionalRequirements: makeNonFunctionalRequirementsContent(),
        constraintsAndAssumptions: makeConstraintsAndAssumptionsContent(),
      },
      { maxRetries: 0 },
    );
    expect(result.output.risks).toHaveLength(0);
    expect(result.output.overallRiskRating).toBe('low');
  });
});
