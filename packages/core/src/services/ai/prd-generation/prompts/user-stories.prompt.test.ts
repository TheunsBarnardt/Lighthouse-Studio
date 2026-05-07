/**
 * Tests for the User Stories prompt — prd.user_stories
 */

import { describe, it, expect } from 'vitest';

import { UserStoriesContentSchema } from '../types.js';
import {
  makeSuccessAiPort,
  makeMalformedAiPort,
  makeFailingAiPort,
  makeIntentBrief,
  makeGoalsContent,
  makeTargetUsersContent,
} from './test-helpers.js';
import { createUserStoriesPrompt } from './user-stories.prompt.js';

// ── Valid output fixture ───────────────────────────────────────────────────────

const VALID_OUTPUT = {
  stories: [
    {
      id: 'US-1',
      persona: 'persona-1',
      capability: 'view a consolidated summary of all my sub-accounts and usage',
      benefit: 'I can monitor our account health without calling support',
      formatted:
        'As an Enterprise Account Manager, I want to view a consolidated summary of all my sub-accounts and usage, so that I can monitor our account health without calling support.',
      acceptanceCriteria: [
        {
          id: 'AC-1',
          given: 'I am authenticated and my account has at least one sub-account',
          when: 'I navigate to the account overview page',
          then: 'The system displays all sub-accounts with current usage metrics, billing status, and account health indicators',
        },
        {
          id: 'AC-2',
          given:
            'I am viewing the account overview and my data was last refreshed more than 5 minutes ago',
          when: 'I click the refresh button',
          then: 'The system re-fetches all sub-account data and updates the dashboard within 3 seconds',
        },
      ],
      priority: 'must',
      storyPoints: 5,
      tracesTo: [
        { type: 'intent_brief', artifactId: 'pipeline-test-001', fieldPath: 'goals.goal-2' },
      ],
    },
    {
      id: 'US-2',
      persona: 'persona-1',
      capability: 'download invoices for any billing period',
      benefit: 'I can fulfil accounting requirements without contacting the billing team',
      formatted:
        'As an Enterprise Account Manager, I want to download invoices for any billing period, so that I can fulfil accounting requirements without contacting the billing team.',
      acceptanceCriteria: [
        {
          id: 'AC-3',
          given: 'I am authenticated and at least one invoice exists for my account',
          when: 'I navigate to the invoices page and click download on a specific invoice',
          then: 'The system generates and downloads a PDF invoice within 5 seconds',
        },
      ],
      priority: 'must',
      storyPoints: 3,
      tracesTo: [
        { type: 'intent_brief', artifactId: 'pipeline-test-001', fieldPath: 'goals.goal-1' },
      ],
    },
    {
      id: 'US-3',
      persona: 'persona-2',
      capability: 'reset my password without contacting support',
      benefit: 'I can regain access to my account immediately without waiting',
      formatted:
        'As an Individual Customer, I want to reset my password without contacting support, so that I can regain access to my account immediately without waiting.',
      acceptanceCriteria: [
        {
          id: 'AC-4',
          given: 'I am on the login page and have forgotten my password',
          when: 'I click "Forgot Password" and enter my registered email address',
          then: 'The system sends a password reset email to the provided address within 2 minutes',
        },
        {
          id: 'AC-5',
          given: 'I received a password reset email and the link has not expired',
          when: 'I click the reset link and submit a new password meeting complexity requirements',
          then: 'The system updates my password, invalidates the reset token, and logs me in',
        },
      ],
      priority: 'must',
      storyPoints: 3,
      tracesTo: [
        { type: 'intent_brief', artifactId: 'pipeline-test-001', fieldPath: 'goals.goal-1' },
      ],
    },
  ],
};

describe('createUserStoriesPrompt', () => {
  it('returns correct prompt metadata', () => {
    const prompt = createUserStoriesPrompt(makeSuccessAiPort(VALID_OUTPUT));
    expect(prompt.id).toBe('prd.user_stories');
    expect(prompt.version).toBe('1.0.0');
    expect(prompt.estimatedCostRange.maxUsd).toBeGreaterThanOrEqual(0.1);
  });

  it('happy path: returns validated UserStoriesContent', async () => {
    const prompt = createUserStoriesPrompt(makeSuccessAiPort(VALID_OUTPUT));
    const result = await prompt.run({
      intentBrief: makeIntentBrief(),
      targetUsers: makeTargetUsersContent(),
      goals: makeGoalsContent(),
    });

    const parsed = UserStoriesContentSchema.safeParse(result.output);
    expect(parsed.success).toBe(true);

    expect(result.output.stories.length).toBeGreaterThanOrEqual(3);
    const firstStory = result.output.stories[0];
    expect(firstStory).toBeDefined();
    expect(firstStory!.id).toBe('US-1');
    expect(firstStory!.formatted).toContain('As an Enterprise Account Manager');
  });

  it('all stories have at least one acceptance criterion', async () => {
    const prompt = createUserStoriesPrompt(makeSuccessAiPort(VALID_OUTPUT));
    const result = await prompt.run({
      intentBrief: makeIntentBrief(),
      targetUsers: makeTargetUsersContent(),
      goals: makeGoalsContent(),
    });

    for (const story of result.output.stories) {
      expect(story.acceptanceCriteria.length).toBeGreaterThanOrEqual(1);
      for (const ac of story.acceptanceCriteria) {
        expect(ac.given.length).toBeGreaterThan(0);
        expect(ac.when.length).toBeGreaterThan(0);
        expect(ac.then.length).toBeGreaterThan(0);
      }
    }
  });

  it('all stories have at least one tracesTo ref', async () => {
    const prompt = createUserStoriesPrompt(makeSuccessAiPort(VALID_OUTPUT));
    const result = await prompt.run({
      intentBrief: makeIntentBrief(),
      targetUsers: makeTargetUsersContent(),
      goals: makeGoalsContent(),
    });

    for (const story of result.output.stories) {
      expect(story.tracesTo.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('throws after retries on malformed JSON response', async () => {
    const prompt = createUserStoriesPrompt(makeMalformedAiPort());
    await expect(
      prompt.run(
        {
          intentBrief: makeIntentBrief(),
          targetUsers: makeTargetUsersContent(),
          goals: makeGoalsContent(),
        },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow();
  });

  it('throws when AI port fails', async () => {
    const prompt = createUserStoriesPrompt(makeFailingAiPort());
    await expect(
      prompt.run(
        {
          intentBrief: makeIntentBrief(),
          targetUsers: makeTargetUsersContent(),
          goals: makeGoalsContent(),
        },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow();
  });

  it('schema rejects stories without acceptance criteria', async () => {
    const bad = {
      stories: [
        {
          id: 'US-1',
          persona: 'persona-1',
          capability: 'do something',
          benefit: 'gain value',
          formatted: 'As a user, I want to do something, so that I gain value.',
          acceptanceCriteria: [], // empty — schema requires min(1)
          priority: 'must',
          tracesTo: [],
        },
      ],
    };
    const prompt = createUserStoriesPrompt(makeSuccessAiPort(bad));
    await expect(
      prompt.run(
        {
          intentBrief: makeIntentBrief(),
          targetUsers: makeTargetUsersContent(),
          goals: makeGoalsContent(),
        },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow(/Schema validation failed/);
  });
});
