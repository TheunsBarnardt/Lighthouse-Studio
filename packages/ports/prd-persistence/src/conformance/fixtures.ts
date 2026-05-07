/**
 * Test fixtures for PRD persistence conformance suites.
 *
 * Factory functions produce valid, fully-populated entities. Pass an `overrides`
 * object to customise individual fields for a specific test.
 */

import type { PrdArtifact, PrdSection, PrdSectionType, PrdTemplate } from '@platform/core';

import { uuidv7 } from 'uuidv7';

// ── Shared sub-object builders ────────────────────────────────────────────────

function makeReasoningRecord() {
  return {
    summary: 'Test reasoning summary',
    steps: ['Step 1: analyse intent', 'Step 2: draft output'],
    model: 'claude-3-5-sonnet-20241022',
    inputTokens: 1200,
    outputTokens: 800,
    costUsd: 0.006,
    generatedAt: new Date('2024-01-01T00:00:00Z'),
    provider: 'anthropic',
  };
}

function makeQualitySignals() {
  return {
    generationAttempts: 1,
    revisionCount: 0,
    approvedOnFirstPass: true,
  };
}

function makeGenerationMetadata() {
  return {
    totalGenerationTimeMs: 12000,
    totalCostUsd: 0.06,
    sectionGenerationOrder: ['overview' as PrdSectionType],
    templateUsed: 'default',
    providersSummary: { anthropic: 1 },
  };
}

// ── PrdArtifact factory ───────────────────────────────────────────────────────

export function makePrdArtifact(overrides?: Partial<PrdArtifact>): PrdArtifact {
  const now = new Date();
  const intentBriefId = uuidv7();
  const sectionId = uuidv7();

  const base: PrdArtifact = {
    id: uuidv7(),
    workspaceId: uuidv7(),
    pipelineId: uuidv7(),
    artifactType: 'prd',
    version: 1,
    status: 'draft',
    content: {
      intentBriefId,
      templateUsed: 'default',
      sectionIds: {
        overview: sectionId,
        goals_and_success_metrics: uuidv7(),
        target_users_and_personas: uuidv7(),
        user_stories: uuidv7(),
        functional_requirements: uuidv7(),
        non_functional_requirements: uuidv7(),
        constraints_and_assumptions: uuidv7(),
        out_of_scope: uuidv7(),
        open_questions: uuidv7(),
        risks_and_mitigations: uuidv7(),
      },
      generationMetadata: makeGenerationMetadata(),
    },
    reasoning: makeReasoningRecord(),
    qualitySignals: makeQualitySignals(),
    createdBy: uuidv7(),
    updatedBy: uuidv7(),
    createdAt: now,
    updatedAt: now,
  };

  return { ...base, ...overrides };
}

// ── PrdSection factory ────────────────────────────────────────────────────────

export function makePrdSection(
  prdId: string,
  sectionType: PrdSectionType,
  overrides?: Partial<PrdSection>,
): PrdSection {
  const now = new Date();

  const base: PrdSection = {
    id: uuidv7(),
    prdId,
    sectionType,
    status: 'draft',
    version: 1,
    content: {
      // Minimal valid OverviewContent — sufficient for any sectionType in tests
      // (conformance tests treat content as an opaque blob; the service validates
      //  per-section structure; the repo just stores/retrieves what it's given.)
      summary: 'Test overview summary',
      background: 'Test background',
      problemStatement: 'Test problem statement',
      proposedSolution: 'Test proposed solution',
      keyBenefits: ['benefit-1'],
    },
    reasoning: makeReasoningRecord(),
    createdAt: now,
    updatedAt: now,
  };

  return { ...base, ...overrides };
}

// ── PrdTemplate factory ───────────────────────────────────────────────────────

export function makePrdTemplate(
  workspaceId: string,
  overrides?: Partial<PrdTemplate & { id: string; createdAt: Date; updatedAt: Date }>,
): PrdTemplate & { id: string; createdAt: Date; updatedAt: Date } {
  const now = new Date();

  const base: PrdTemplate & { id: string; createdAt: Date; updatedAt: Date } = {
    id: uuidv7(),
    workspaceId,
    name: 'Test Template',
    description: 'A workspace-scoped test template',
    category: 'general',
    sectionStarters: {
      overview: 'Start with a concise executive summary.',
    },
    builtIn: false,
    createdByUserId: uuidv7(),
    createdAt: now,
    updatedAt: now,
  };

  return { ...base, ...overrides };
}
