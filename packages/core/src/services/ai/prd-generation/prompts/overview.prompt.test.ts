/**
 * Tests for the Overview prompt — prd.overview
 */

import type { AiGenerationPort } from '@platform/ports-ai';

import { ok, err } from 'neverthrow';
import { describe, it, expect, vi } from 'vitest';

import type { IntentBrief } from '../../intent-capture/types.js';

import { OverviewContentSchema } from '../types.js';
import { createOverviewPrompt } from './overview.prompt.js';

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeIntentBrief(): IntentBrief {
  return {
    workspaceId: '00000000-0000-0000-0000-000000000001',
    pipelineId: 'pipeline-001',
    title: 'Customer Self-Service Portal',
    description: 'A portal enabling customers to manage their accounts without contacting support.',
    projectType: 'customer_portal',
    goals: [
      { id: 'goal-1', description: 'Reduce support tickets by 40%', priority: 'must' },
      { id: 'goal-2', description: 'Improve customer satisfaction', priority: 'should' },
    ],
    targetUsers: [
      {
        id: 'persona-1',
        name: 'Enterprise Customer',
        description: 'A business customer managing multiple accounts.',
        needs: ['Account overview', 'Invoice download'],
        painPoints: ['Manual processes'],
      },
    ],
    inScope: ['Account management', 'Invoice download', 'Password reset'],
    outOfScope: ['New account registration', 'Admin panel'],
    constraints: [{ id: 'con-1', description: 'Must use existing SSO', type: 'technical' }],
    assumptions: ['Customers already have accounts'],
    approvedAt: '2026-01-15T10:00:00.000Z',
  };
}

const VALID_OVERVIEW_OUTPUT = {
  summary:
    'The Customer Self-Service Portal gives enterprise customers direct control over their accounts, reducing dependency on support staff.',
  background:
    'Customer support currently handles thousands of routine requests per month. A self-service portal will automate the most common workflows.',
  problemStatement:
    'Customers cannot manage their own accounts without contacting support, resulting in high support volume and slow resolution times.',
  proposedSolution:
    'Build a web portal that lets customers view, update, and download their account information without support intervention.',
  keyBenefits: [
    'Reduces support ticket volume by 40%',
    'Enables 24/7 account management without staffing overhead',
    'Improves customer satisfaction through faster self-service',
  ],
};

function makeAiPort(responseJson: unknown): AiGenerationPort {
  return {
    generate: vi.fn().mockResolvedValue(
      ok({
        content: JSON.stringify(responseJson),
        model: 'claude-3-5-sonnet-20241022',
        reasoning: 'Generated overview from intent brief.',
        usage: { inputTokens: 500, outputTokens: 350, totalTokens: 850 },
        finishReason: 'stop' as const,
      }),
    ),
    stream: vi.fn(),
    countTokens: vi.fn(),
    availableModels: vi.fn().mockReturnValue([]),
  };
}

function makeFailingAiPort(message = 'Model unavailable'): AiGenerationPort {
  return {
    generate: vi.fn().mockResolvedValue(err({ message, code: 'PROVIDER_ERROR' })),
    stream: vi.fn(),
    countTokens: vi.fn(),
    availableModels: vi.fn().mockReturnValue([]),
  };
}

function makeMalformedAiPort(): AiGenerationPort {
  return {
    generate: vi.fn().mockResolvedValue(
      ok({
        content: 'not valid json at all',
        model: 'claude-3-5-sonnet-20241022',
        reasoning: undefined,
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
        finishReason: 'stop' as const,
      }),
    ),
    stream: vi.fn(),
    countTokens: vi.fn(),
    availableModels: vi.fn().mockReturnValue([]),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createOverviewPrompt', () => {
  it('returns a PromptDefinition with correct metadata', () => {
    const prompt = createOverviewPrompt(makeAiPort(VALID_OVERVIEW_OUTPUT));
    expect(prompt.id).toBe('prd.overview');
    expect(prompt.version).toBe('1.0.0');
    expect(prompt.estimatedCostRange.minUsd).toBeGreaterThan(0);
    expect(prompt.estimatedCostRange.maxUsd).toBeGreaterThan(prompt.estimatedCostRange.minUsd);
  });

  it('happy path: returns validated OverviewContent and reasoning', async () => {
    const ai = makeAiPort(VALID_OVERVIEW_OUTPUT);
    const prompt = createOverviewPrompt(ai);

    const result = await prompt.run({ intentBrief: makeIntentBrief() });

    // Validate output shape against the schema
    const parsed = OverviewContentSchema.safeParse(result.output);
    expect(parsed.success).toBe(true);

    expect(result.output.summary).toBe(VALID_OVERVIEW_OUTPUT.summary);
    expect(result.output.keyBenefits).toHaveLength(3);

    // Reasoning should be populated
    expect(result.reasoning.model).toBe('claude-3-5-sonnet-20241022');
    expect(result.reasoning.inputTokens).toBe(500);
    expect(result.reasoning.outputTokens).toBe(350);
    expect(result.reasoning.provider).toBe('anthropic');
  });

  it('passes templateHints in the message when provided', async () => {
    const ai = makeAiPort(VALID_OVERVIEW_OUTPUT);
    const prompt = createOverviewPrompt(ai);

    await prompt.run({
      intentBrief: makeIntentBrief(),
      templateHints: 'Emphasise regulatory compliance context.',
    });

    const calls = (ai.generate as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const messages = calls[0]![0] as Array<{ role: string; content: string }>;
    expect(messages[0]!.content).toContain('Template Hints');
    expect(messages[0]!.content).toContain('Emphasise regulatory compliance context.');
  });

  it('throws after max retries when model returns malformed JSON', async () => {
    const ai = makeMalformedAiPort();
    const prompt = createOverviewPrompt(ai);

    await expect(
      prompt.run({ intentBrief: makeIntentBrief() }, { maxRetries: 1 }),
    ).rejects.toThrow();

    // Should have been called maxRetries + 1 times
    expect((ai.generate as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it('throws after max retries when model returns schema-invalid JSON', async () => {
    // Missing required fields
    const badOutput = { summary: 'OK' }; // missing problemStatement, proposedSolution, etc.
    const ai = makeAiPort(badOutput);
    const prompt = createOverviewPrompt(ai);

    await expect(prompt.run({ intentBrief: makeIntentBrief() }, { maxRetries: 0 })).rejects.toThrow(
      /Schema validation failed/,
    );
  });

  it('throws when AI port returns an error', async () => {
    const ai = makeFailingAiPort('Service temporarily unavailable');
    const prompt = createOverviewPrompt(ai);

    await expect(
      prompt.run({ intentBrief: makeIntentBrief() }, { maxRetries: 0 }),
    ).rejects.toThrow();
  });

  it('accepts output wrapped in a markdown code block', async () => {
    const wrapped = `\`\`\`json\n${JSON.stringify(VALID_OVERVIEW_OUTPUT)}\n\`\`\``;
    const ai: AiGenerationPort = {
      generate: vi.fn().mockResolvedValue(
        ok({
          content: wrapped,
          model: 'claude-3-5-sonnet-20241022',
          reasoning: undefined,
          usage: { inputTokens: 400, outputTokens: 300, totalTokens: 700 },
          finishReason: 'stop' as const,
        }),
      ),
      stream: vi.fn(),
      countTokens: vi.fn(),
      availableModels: vi.fn().mockReturnValue([]),
    };
    const prompt = createOverviewPrompt(ai);
    const result = await prompt.run({ intentBrief: makeIntentBrief() });
    expect(result.output.problemStatement).toBe(VALID_OVERVIEW_OUTPUT.problemStatement);
  });
});
