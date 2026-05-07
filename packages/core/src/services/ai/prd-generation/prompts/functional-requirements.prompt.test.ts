/**
 * Tests for the Functional Requirements prompt — prd.functional_requirements
 */

import { describe, it, expect } from 'vitest';

import { FunctionalRequirementsContentSchema } from '../types.js';
import { createFunctionalRequirementsPrompt } from './functional-requirements.prompt.js';
import {
  makeSuccessAiPort,
  makeMalformedAiPort,
  makeFailingAiPort,
  makeIntentBrief,
  makeGoalsContent,
  makeUserStoriesContent,
} from './test-helpers.js';

// ── Valid output fixture ───────────────────────────────────────────────────────

const VALID_OUTPUT = {
  requirements: [
    {
      id: 'FR-1',
      title: 'Account Overview Dashboard',
      description:
        'The system shall display a consolidated dashboard for the authenticated user showing all associated accounts and sub-accounts, including usage metrics, billing status, and account health indicators. The dashboard shall refresh data on demand and automatically every 5 minutes.',
      priority: 'must',
      acceptanceCriteria: [
        {
          id: 'FR-1-AC-1',
          given: 'An authenticated user with one or more accounts in the system',
          when: 'The user navigates to /dashboard',
          then: 'The system renders account cards for all associated accounts with current usage, billing status, and health indicators',
        },
        {
          id: 'FR-1-AC-2',
          given: 'An authenticated user on the dashboard page',
          when: 'The user clicks the refresh button',
          then: 'The system re-fetches all account data and updates the display within 3 seconds',
        },
      ],
      tracesTo: [
        { type: 'intent_brief', artifactId: 'pipeline-test-001', fieldPath: 'goals.goal-2' },
      ],
      relatedStories: ['US-1'],
    },
    {
      id: 'FR-2',
      title: 'Invoice Download',
      description:
        "The system shall provide a paginated list of all invoices associated with the user's accounts. Users shall be able to download any invoice as a PDF. The invoice list shall be filterable by date range and account.",
      priority: 'must',
      acceptanceCriteria: [
        {
          id: 'FR-2-AC-1',
          given: 'An authenticated user with at least one invoice on their account',
          when: 'The user navigates to the invoices page',
          then: 'The system displays a paginated list of invoices sorted by date descending, with account name, period, and amount',
        },
        {
          id: 'FR-2-AC-2',
          given: 'An authenticated user viewing the invoice list',
          when: 'The user clicks "Download" on any invoice',
          then: 'The system generates and delivers a PDF of the invoice to the browser within 5 seconds',
        },
      ],
      tracesTo: [
        { type: 'intent_brief', artifactId: 'pipeline-test-001', fieldPath: 'goals.goal-1' },
      ],
      relatedStories: ['US-2'],
    },
    {
      id: 'FR-3',
      title: 'Self-Service Password Reset',
      description:
        "The system shall provide a password reset flow accessible from the login page. The flow shall send a time-limited reset link to the user's registered email. The link shall expire after 30 minutes and be single-use.",
      priority: 'must',
      acceptanceCriteria: [
        {
          id: 'FR-3-AC-1',
          given: 'An unauthenticated user on the login page',
          when: 'The user submits a valid registered email via the Forgot Password form',
          then: 'The system sends a reset email containing a unique token-based link expiring in 30 minutes',
        },
        {
          id: 'FR-3-AC-2',
          given: 'A user who has received a reset email and the link has not expired',
          when: 'The user visits the reset link URL and submits a new password meeting complexity requirements',
          then: 'The system updates the password, invalidates the token, and redirects the user to the login page with a success message',
        },
        {
          id: 'FR-3-AC-3',
          given: 'A user who has received a reset email and the 30-minute window has elapsed',
          when: 'The user clicks the reset link',
          then: 'The system returns an expired-link error page and offers the option to request a new reset email',
        },
      ],
      tracesTo: [
        { type: 'intent_brief', artifactId: 'pipeline-test-001', fieldPath: 'goals.goal-1' },
      ],
      relatedStories: ['US-3'],
    },
  ],
};

describe('createFunctionalRequirementsPrompt', () => {
  it('returns correct prompt metadata', () => {
    const prompt = createFunctionalRequirementsPrompt(makeSuccessAiPort(VALID_OUTPUT));
    expect(prompt.id).toBe('prd.functional_requirements');
    expect(prompt.version).toBe('1.0.0');
  });

  it('happy path: returns validated FunctionalRequirementsContent', async () => {
    const prompt = createFunctionalRequirementsPrompt(makeSuccessAiPort(VALID_OUTPUT));
    const result = await prompt.run({
      intentBrief: makeIntentBrief(),
      userStories: makeUserStoriesContent(),
      goals: makeGoalsContent(),
    });

    const parsed = FunctionalRequirementsContentSchema.safeParse(result.output);
    expect(parsed.success).toBe(true);

    expect(result.output.requirements.length).toBeGreaterThanOrEqual(2);
  });

  it('every FR has at least one acceptance criterion', async () => {
    const prompt = createFunctionalRequirementsPrompt(makeSuccessAiPort(VALID_OUTPUT));
    const result = await prompt.run({
      intentBrief: makeIntentBrief(),
      userStories: makeUserStoriesContent(),
      goals: makeGoalsContent(),
    });

    for (const req of result.output.requirements) {
      expect(req.acceptanceCriteria.length).toBeGreaterThanOrEqual(1);
      for (const ac of req.acceptanceCriteria) {
        expect(ac.id).toMatch(/^FR-\d+-AC-\d+$/);
        expect(ac.given.length).toBeGreaterThan(0);
        expect(ac.when.length).toBeGreaterThan(0);
        expect(ac.then.length).toBeGreaterThan(0);
      }
    }
  });

  it('every FR has at least one tracesTo ref', async () => {
    const prompt = createFunctionalRequirementsPrompt(makeSuccessAiPort(VALID_OUTPUT));
    const result = await prompt.run({
      intentBrief: makeIntentBrief(),
      userStories: makeUserStoriesContent(),
      goals: makeGoalsContent(),
    });

    for (const req of result.output.requirements) {
      expect(req.tracesTo.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('throws after retries on malformed JSON response', async () => {
    const prompt = createFunctionalRequirementsPrompt(makeMalformedAiPort());
    await expect(
      prompt.run(
        {
          intentBrief: makeIntentBrief(),
          userStories: makeUserStoriesContent(),
          goals: makeGoalsContent(),
        },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow();
  });

  it('throws when AI port fails', async () => {
    const prompt = createFunctionalRequirementsPrompt(makeFailingAiPort());
    await expect(
      prompt.run(
        {
          intentBrief: makeIntentBrief(),
          userStories: makeUserStoriesContent(),
          goals: makeGoalsContent(),
        },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow();
  });

  it('schema rejects FR with empty acceptanceCriteria', async () => {
    const bad = {
      requirements: [
        {
          id: 'FR-1',
          title: 'Some Feature',
          description: 'The system shall do something.',
          priority: 'must',
          acceptanceCriteria: [], // empty — schema requires min(1)
          tracesTo: [{ type: 'intent_brief', artifactId: 'p-001', fieldPath: 'goals.goal-1' }],
        },
      ],
    };
    const prompt = createFunctionalRequirementsPrompt(makeSuccessAiPort(bad));
    await expect(
      prompt.run(
        {
          intentBrief: makeIntentBrief(),
          userStories: makeUserStoriesContent(),
          goals: makeGoalsContent(),
        },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow(/Schema validation failed/);
  });

  it('schema rejects FR with empty tracesTo', async () => {
    const bad = {
      requirements: [
        {
          id: 'FR-1',
          title: 'Some Feature',
          description: 'The system shall do something.',
          priority: 'must',
          acceptanceCriteria: [{ id: 'FR-1-AC-1', given: 'Given', when: 'When', then: 'Then' }],
          tracesTo: [], // empty — schema requires min(1)
        },
      ],
    };
    const prompt = createFunctionalRequirementsPrompt(makeSuccessAiPort(bad));
    await expect(
      prompt.run(
        {
          intentBrief: makeIntentBrief(),
          userStories: makeUserStoriesContent(),
          goals: makeGoalsContent(),
        },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow(/Schema validation failed/);
  });
});
