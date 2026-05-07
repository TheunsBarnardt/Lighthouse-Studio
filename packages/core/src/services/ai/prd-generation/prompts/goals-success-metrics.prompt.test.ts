/**
 * Tests for the Goals and Success Metrics prompt — prd.goals_and_success_metrics
 */

import type { vi } from 'vitest';

import { describe, it, expect } from 'vitest';

import { GoalsAndSuccessMetricsContentSchema } from '../types.js';
import { createGoalsSuccessMetricsPrompt } from './goals-success-metrics.prompt.js';
import {
  makeSuccessAiPort,
  makeMalformedAiPort,
  makeFailingAiPort,
  makeIntentBrief,
  makeOverviewContent,
} from './test-helpers.js';

// ── Valid output fixture ───────────────────────────────────────────────────────

const VALID_OUTPUT = {
  goals: [
    {
      id: 'goal-1',
      description: 'Reduce support ticket volume by 40%',
      priority: 'must',
      successMetric:
        'Monthly ticket count drops from 8,000 to under 4,800 within 6 months of launch',
      measurementMethod: 'Zendesk monthly ticket aggregate report',
      tracesTo: [
        { type: 'intent_brief', artifactId: 'pipeline-test-001', fieldPath: 'goals.goal-1' },
      ],
    },
    {
      id: 'goal-2',
      description: 'Enable 24/7 self-service account management',
      priority: 'must',
      successMetric: '80% of account changes completed through the portal without a support ticket',
      measurementMethod: 'Portal analytics: self-service completion rate metric',
      tracesTo: [
        { type: 'intent_brief', artifactId: 'pipeline-test-001', fieldPath: 'goals.goal-2' },
      ],
    },
    {
      id: 'goal-3',
      description: 'Improve customer satisfaction scores',
      priority: 'should',
      successMetric: 'NPS improves by 15 points within 12 months of launch',
      measurementMethod: 'Quarterly NPS survey via Delighted platform',
      tracesTo: [
        { type: 'intent_brief', artifactId: 'pipeline-test-001', fieldPath: 'goals.goal-3' },
      ],
    },
  ],
  overallSuccessCriteria:
    'The portal is successful when support ticket volume is reduced by 40% and NPS improves by 15 points within one year.',
};

describe('createGoalsSuccessMetricsPrompt', () => {
  it('returns correct prompt metadata', () => {
    const prompt = createGoalsSuccessMetricsPrompt(makeSuccessAiPort(VALID_OUTPUT));
    expect(prompt.id).toBe('prd.goals_and_success_metrics');
    expect(prompt.version).toBe('1.0.0');
    expect(prompt.estimatedCostRange.minUsd).toBeGreaterThan(0);
  });

  it('happy path: returns validated GoalsAndSuccessMetricsContent', async () => {
    const prompt = createGoalsSuccessMetricsPrompt(makeSuccessAiPort(VALID_OUTPUT));
    const result = await prompt.run({
      intentBrief: makeIntentBrief(),
      overview: makeOverviewContent(),
    });

    const parsed = GoalsAndSuccessMetricsContentSchema.safeParse(result.output);
    expect(parsed.success).toBe(true);

    expect(result.output.goals).toHaveLength(3);
    const firstGoal = result.output.goals[0];
    expect(firstGoal).toBeDefined();
    expect(firstGoal!.id).toBe('goal-1');
    expect(firstGoal!.tracesTo).toHaveLength(1);
    expect(result.output.overallSuccessCriteria.length).toBeGreaterThan(0);
    expect(result.reasoning.provider).toBe('anthropic');
  });

  it('includes overview and intent brief in messages', async () => {
    const ai = makeSuccessAiPort(VALID_OUTPUT);
    const prompt = createGoalsSuccessMetricsPrompt(ai);
    const overview = makeOverviewContent();

    await prompt.run({ intentBrief: makeIntentBrief(), overview });

    const calls = (ai.generate as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const messages = calls[0]![0] as Array<{ role: string; content: string }>;
    expect(messages[0]!.content).toContain('Intent Brief');
    expect(messages[0]!.content).toContain('Overview');
    expect(messages[0]!.content).toContain(overview.summary);
  });

  it('throws after retries when model returns malformed JSON', async () => {
    const prompt = createGoalsSuccessMetricsPrompt(makeMalformedAiPort());
    await expect(
      prompt.run(
        { intentBrief: makeIntentBrief(), overview: makeOverviewContent() },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow();
  });

  it('throws when AI port fails', async () => {
    const prompt = createGoalsSuccessMetricsPrompt(makeFailingAiPort());
    await expect(
      prompt.run(
        { intentBrief: makeIntentBrief(), overview: makeOverviewContent() },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow();
  });

  it('schema rejects output with missing goals array', async () => {
    const bad = { overallSuccessCriteria: 'Success' }; // missing goals
    const prompt = createGoalsSuccessMetricsPrompt(makeSuccessAiPort(bad));
    await expect(
      prompt.run(
        { intentBrief: makeIntentBrief(), overview: makeOverviewContent() },
        { maxRetries: 0 },
      ),
    ).rejects.toThrow(/Schema validation failed/);
  });
});
