/**
 * Tests for the Non-Functional Requirements prompt — prd.non_functional_requirements
 */

import { describe, it, expect } from 'vitest';

import { NonFunctionalRequirementsContentSchema } from '../types.js';
import { createNonFunctionalRequirementsPrompt } from './non-functional-requirements.prompt.js';
import {
  makeSuccessAiPort,
  makeMalformedAiPort,
  makeFailingAiPort,
  makeIntentBrief,
  makeFunctionalRequirementsContent,
} from './test-helpers.js';

// ── Valid output fixture ───────────────────────────────────────────────────────

const VALID_OUTPUT = {
  requirements: [
    {
      id: 'NFR-1',
      category: 'performance',
      title: 'Dashboard Page Load Performance',
      description:
        'The account dashboard must load within 3 seconds at the 95th percentile for users on a standard business internet connection to ensure usability for enterprise account managers who rely on it daily.',
      acceptanceCriteria: [
        {
          id: 'NFR-1-AC-1',
          metric: 'Dashboard time-to-interactive (TTI) at p95',
          threshold: '< 3 seconds',
          measurement:
            'Lighthouse CI automated test against staging environment, network throttled to 20 Mbps, executed on every deployment',
        },
      ],
      tracesTo: [],
    },
    {
      id: 'NFR-2',
      category: 'security',
      title: 'Authentication and Session Security',
      description:
        'All authentication must integrate with the existing SAML 2.0 SSO provider. Sessions must use signed JWTs with short expiry. Sensitive operations (password change, invoice download) must verify session freshness.',
      acceptanceCriteria: [
        {
          id: 'NFR-2-AC-1',
          metric: 'Session token algorithm and expiry',
          threshold: 'RS256 JWT, 1-hour expiry, with refresh tokens',
          measurement: 'Code review plus OWASP ZAP automated security scan on staging',
        },
        {
          id: 'NFR-2-AC-2',
          metric: 'SAML assertion validation',
          threshold: 'All SAML assertions validated per XML Signature spec; no assertion reuse',
          measurement: 'Unit tests covering assertion parsing, integration test with test IdP',
        },
      ],
      tracesTo: [
        {
          type: 'intent_brief',
          artifactId: 'pipeline-test-001',
          fieldPath: 'constraints.con-1',
        },
      ],
    },
    {
      id: 'NFR-3',
      category: 'accessibility',
      title: 'WCAG 2.1 AA Accessibility Compliance',
      description:
        'All portal pages must meet WCAG 2.1 Level AA accessibility standards to serve users with disabilities and fulfil legal obligations in applicable jurisdictions.',
      acceptanceCriteria: [
        {
          id: 'NFR-3-AC-1',
          metric: 'WCAG 2.1 AA conformance',
          threshold: '0 critical or serious violations per page as reported by axe-core',
          measurement:
            'axe-core automated scan integrated in CI pipeline; manual expert review of 5 key pages per release',
        },
      ],
      tracesTo: [],
    },
    {
      id: 'NFR-4',
      category: 'reliability',
      title: 'Portal Availability',
      description:
        'The portal must be available at or above the agreed uptime threshold during business hours globally to support enterprise customers in multiple time zones.',
      acceptanceCriteria: [
        {
          id: 'NFR-4-AC-1',
          metric: 'Monthly uptime percentage',
          threshold: '>= 99.5% excluding scheduled maintenance windows',
          measurement:
            'Synthetic monitoring via Datadog from 3 geographic regions, monthly SLA report',
        },
      ],
      tracesTo: [],
    },
  ],
};

describe('createNonFunctionalRequirementsPrompt', () => {
  it('returns correct prompt metadata', () => {
    const prompt = createNonFunctionalRequirementsPrompt(makeSuccessAiPort(VALID_OUTPUT));
    expect(prompt.id).toBe('prd.non_functional_requirements');
    expect(prompt.version).toBe('1.0.0');
  });

  it('happy path: returns validated NonFunctionalRequirementsContent', async () => {
    const prompt = createNonFunctionalRequirementsPrompt(makeSuccessAiPort(VALID_OUTPUT));
    const result = await prompt.run({
      intentBrief: makeIntentBrief(),
      functionalRequirements: makeFunctionalRequirementsContent(),
    });

    const parsed = NonFunctionalRequirementsContentSchema.safeParse(result.output);
    expect(parsed.success).toBe(true);

    expect(result.output.requirements.length).toBeGreaterThanOrEqual(3);
  });

  it('each NFR has at least one acceptance criterion with metric, threshold', async () => {
    const prompt = createNonFunctionalRequirementsPrompt(makeSuccessAiPort(VALID_OUTPUT));
    const result = await prompt.run({
      intentBrief: makeIntentBrief(),
      functionalRequirements: makeFunctionalRequirementsContent(),
    });

    for (const req of result.output.requirements) {
      expect(req.acceptanceCriteria.length).toBeGreaterThanOrEqual(1);
      for (const ac of req.acceptanceCriteria) {
        expect(ac.metric.length).toBeGreaterThan(0);
        expect(ac.threshold.length).toBeGreaterThan(0);
      }
    }
  });

  it('categories used are valid NFR categories', async () => {
    const validCategories = [
      'performance',
      'security',
      'scalability',
      'usability',
      'accessibility',
      'reliability',
      'maintainability',
      'portability',
    ];
    const prompt = createNonFunctionalRequirementsPrompt(makeSuccessAiPort(VALID_OUTPUT));
    const result = await prompt.run({
      intentBrief: makeIntentBrief(),
      functionalRequirements: makeFunctionalRequirementsContent(),
    });

    for (const req of result.output.requirements) {
      expect(validCategories).toContain(req.category);
    }
  });

  it('throws after retries on malformed JSON', async () => {
    const prompt = createNonFunctionalRequirementsPrompt(makeMalformedAiPort());
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
    const prompt = createNonFunctionalRequirementsPrompt(makeFailingAiPort());
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

  it('schema rejects NFR with empty acceptanceCriteria', async () => {
    const bad = {
      requirements: [
        {
          id: 'NFR-1',
          category: 'performance',
          title: 'Performance',
          description: 'Must be fast.',
          acceptanceCriteria: [], // empty — schema requires min(1)
          tracesTo: [],
        },
      ],
    };
    const prompt = createNonFunctionalRequirementsPrompt(makeSuccessAiPort(bad));
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
