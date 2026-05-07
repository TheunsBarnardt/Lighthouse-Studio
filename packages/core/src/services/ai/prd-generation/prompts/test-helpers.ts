/**
 * Shared test helpers for PRD prompt tests.
 * Not exported from the package — test-only.
 */

import type { AiGenerationPort } from '@platform/ports-ai';

import { ok, err } from 'neverthrow';
import { vi } from 'vitest';

import type { IntentBrief } from '../../intent-capture/types.js';
import type {
  FunctionalRequirementsContent,
  GoalsAndSuccessMetricsContent,
  NonFunctionalRequirementsContent,
  OverviewContent,
  TargetUsersContent,
  ConstraintsAndAssumptionsContent,
  UserStoriesContent,
} from '../types.js';

// ── AI port factories ─────────────────────────────────────────────────────────

export function makeSuccessAiPort(responseJson: unknown): AiGenerationPort {
  return {
    generate: vi.fn().mockResolvedValue(
      ok({
        content: JSON.stringify(responseJson),
        model: 'claude-3-5-sonnet-20241022',
        reasoning: 'Test reasoning output.',
        usage: { inputTokens: 600, outputTokens: 400, totalTokens: 1000 },
        finishReason: 'stop' as const,
      }),
    ),
    stream: vi.fn(),
    countTokens: vi.fn(),
    availableModels: vi.fn().mockReturnValue(['claude-3-5-sonnet-20241022']),
  };
}

export function makeMalformedAiPort(): AiGenerationPort {
  return {
    generate: vi.fn().mockResolvedValue(
      ok({
        content: 'this is not json !!!',
        model: 'claude-3-5-sonnet-20241022',
        reasoning: undefined,
        usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 },
        finishReason: 'stop' as const,
      }),
    ),
    stream: vi.fn(),
    countTokens: vi.fn(),
    availableModels: vi.fn().mockReturnValue([]),
  };
}

export function makeFailingAiPort(): AiGenerationPort {
  return {
    generate: vi.fn().mockResolvedValue(err({ message: 'Provider error', code: 'PROVIDER_ERROR' })),
    stream: vi.fn(),
    countTokens: vi.fn(),
    availableModels: vi.fn().mockReturnValue([]),
  };
}

// ── Intent Brief fixture ──────────────────────────────────────────────────────

export function makeIntentBrief(overrides?: Partial<IntentBrief>): IntentBrief {
  return {
    workspaceId: '00000000-0000-0000-0000-000000000001',
    pipelineId: 'pipeline-test-001',
    title: 'Customer Self-Service Portal',
    description:
      'A portal enabling customers to manage their accounts, download invoices, and reset passwords without contacting support.',
    projectType: 'customer_portal',
    goals: [
      { id: 'goal-1', description: 'Reduce support ticket volume by 40%', priority: 'must' },
      {
        id: 'goal-2',
        description: 'Enable 24/7 self-service account management',
        priority: 'must',
      },
      { id: 'goal-3', description: 'Improve customer satisfaction scores', priority: 'should' },
    ],
    targetUsers: [
      {
        id: 'persona-1',
        name: 'Enterprise Account Manager',
        description:
          'A business user managing multiple sub-accounts under one enterprise contract.',
        needs: ['Consolidated account overview', 'Invoice download', 'User management'],
        painPoints: ['Must call support for every change', 'No visibility into usage'],
      },
      {
        id: 'persona-2',
        name: 'Individual Customer',
        description: 'A single-account customer who needs basic self-service.',
        needs: ['Password reset', 'Profile update'],
        painPoints: ['Slow email support response times'],
      },
    ],
    inScope: [
      'Account profile management',
      'Invoice download',
      'Password reset',
      'Usage dashboard',
    ],
    outOfScope: ['New account registration', 'Admin panel', 'Payment processing'],
    constraints: [
      {
        id: 'con-1',
        description: 'Must integrate with existing SSO via SAML 2.0',
        type: 'technical',
      },
      { id: 'con-2', description: 'Must comply with GDPR for EU customers', type: 'regulatory' },
    ],
    assumptions: [
      'All customers already have active accounts in the system',
      'SSO integration is available and stable',
    ],
    approvedAt: '2026-01-15T10:00:00.000Z',
    ...overrides,
  };
}

// ── Section content fixtures ──────────────────────────────────────────────────

export function makeOverviewContent(): OverviewContent {
  return {
    summary:
      'The Customer Self-Service Portal enables enterprise and individual customers to manage their accounts independently.',
    background:
      'Currently all account changes require a support ticket, generating 8,000 tickets per month.',
    problemStatement:
      'Customers cannot manage their own accounts, resulting in high support costs and slow resolution times.',
    proposedSolution:
      'A web portal allowing customers to update profiles, download invoices, and reset passwords without support.',
    keyBenefits: [
      'Reduces support ticket volume by 40%',
      'Enables account management outside business hours',
      'Improves customer satisfaction through self-service',
    ],
  };
}

export function makeGoalsContent(): GoalsAndSuccessMetricsContent {
  return {
    goals: [
      {
        id: 'goal-1',
        description: 'Reduce support ticket volume by 40%',
        priority: 'must',
        successMetric:
          'Monthly support ticket count drops from 8,000 to under 4,800 within 6 months',
        measurementMethod: 'Zendesk ticket reporting dashboard, monthly aggregate',
        tracesTo: [
          { type: 'intent_brief', artifactId: 'pipeline-test-001', fieldPath: 'goals.goal-1' },
        ],
      },
      {
        id: 'goal-2',
        description: 'Enable 24/7 self-service account management',
        priority: 'must',
        successMetric: '80% of account changes completed without a support ticket',
        measurementMethod: 'Portal analytics tracking self-service completion rate',
        tracesTo: [
          { type: 'intent_brief', artifactId: 'pipeline-test-001', fieldPath: 'goals.goal-2' },
        ],
      },
      {
        id: 'goal-3',
        description: 'Improve customer satisfaction scores',
        priority: 'should',
        successMetric: 'NPS score improves by 15 points within 12 months of launch',
        measurementMethod: 'Quarterly NPS survey via Delighted',
        tracesTo: [
          { type: 'intent_brief', artifactId: 'pipeline-test-001', fieldPath: 'goals.goal-3' },
        ],
      },
    ],
    overallSuccessCriteria:
      'The portal is considered successful when support ticket volume drops by 40% and NPS improves by 15 points within 12 months.',
  };
}

export function makeTargetUsersContent(): TargetUsersContent {
  return {
    personas: [
      {
        id: 'persona-1',
        name: 'Enterprise Account Manager',
        description: 'A business user responsible for managing multiple sub-accounts.',
        primaryGoals: [
          'View consolidated account summary',
          'Download invoices',
          'Manage team access',
        ],
        painPoints: [
          'Must call support for every account change',
          'No visibility into real-time usage',
          'Slow response times from support team',
        ],
        technicalProficiency: 'medium',
        frequency: 'weekly',
        tracesTo: [
          {
            type: 'intent_brief',
            artifactId: 'pipeline-test-001',
            fieldPath: 'targetUsers.persona-1',
          },
        ],
      },
      {
        id: 'persona-2',
        name: 'Individual Customer',
        description: 'A single-account consumer customer needing basic self-service.',
        primaryGoals: ['Reset password independently', 'Update contact information'],
        painPoints: ['Long email response times', 'No self-service options'],
        technicalProficiency: 'low',
        frequency: 'monthly',
        tracesTo: [
          {
            type: 'intent_brief',
            artifactId: 'pipeline-test-001',
            fieldPath: 'targetUsers.persona-2',
          },
        ],
      },
    ],
    primaryPersona: 'persona-1',
  };
}

export function makeUserStoriesContent(): UserStoriesContent {
  return {
    stories: [
      {
        id: 'US-1',
        persona: 'persona-1',
        capability: 'view a consolidated summary of all my sub-accounts',
        benefit: 'I can monitor our usage without calling support',
        formatted:
          'As an Enterprise Account Manager, I want to view a consolidated summary of all my sub-accounts, so that I can monitor our usage without calling support.',
        acceptanceCriteria: [
          {
            id: 'AC-1',
            given: 'I am authenticated and my account has at least one sub-account',
            when: 'I navigate to the account overview page',
            then: 'The system displays all sub-accounts with current usage and status',
          },
        ],
        priority: 'must',
        tracesTo: [
          { type: 'intent_brief', artifactId: 'pipeline-test-001', fieldPath: 'goals.goal-2' },
        ],
      },
      {
        id: 'US-2',
        persona: 'persona-2',
        capability: 'reset my password without contacting support',
        benefit: 'I can regain access to my account immediately',
        formatted:
          'As an Individual Customer, I want to reset my password without contacting support, so that I can regain access to my account immediately.',
        acceptanceCriteria: [
          {
            id: 'AC-2',
            given: 'I am on the login page and have forgotten my password',
            when: 'I click "Forgot password" and submit my registered email',
            then: 'The system sends a password reset link to my email within 2 minutes',
          },
        ],
        priority: 'must',
        tracesTo: [
          { type: 'intent_brief', artifactId: 'pipeline-test-001', fieldPath: 'goals.goal-1' },
        ],
      },
    ],
  };
}

export function makeFunctionalRequirementsContent(): FunctionalRequirementsContent {
  return {
    requirements: [
      {
        id: 'FR-1',
        title: 'Account Overview Dashboard',
        description:
          'The system shall display a consolidated dashboard showing all accounts and sub-accounts associated with the authenticated user, including current usage, status, and billing period.',
        priority: 'must',
        acceptanceCriteria: [
          {
            id: 'FR-1-AC-1',
            given: 'An authenticated user with one or more accounts',
            when: 'The user navigates to /dashboard',
            then: 'The system renders a list of all accounts with usage metrics and status indicators',
          },
        ],
        tracesTo: [
          { type: 'intent_brief', artifactId: 'pipeline-test-001', fieldPath: 'goals.goal-2' },
        ],
        relatedStories: ['US-1'],
      },
      {
        id: 'FR-2',
        title: 'Self-Service Password Reset',
        description:
          "The system shall provide a password reset flow that sends a time-limited reset link to the user's registered email address. The link shall expire after 30 minutes.",
        priority: 'must',
        acceptanceCriteria: [
          {
            id: 'FR-2-AC-1',
            given: 'An unauthenticated user on the login page',
            when: 'The user submits a valid registered email via the "Forgot Password" form',
            then: 'The system sends a reset email containing a unique link expiring in 30 minutes',
          },
          {
            id: 'FR-2-AC-2',
            given: 'A user who received a reset link',
            when: 'The user clicks the link within 30 minutes and submits a new password',
            then: 'The system updates the password and logs the user in',
          },
        ],
        tracesTo: [
          { type: 'intent_brief', artifactId: 'pipeline-test-001', fieldPath: 'goals.goal-1' },
        ],
        relatedStories: ['US-2'],
      },
    ],
  };
}

export function makeNonFunctionalRequirementsContent(): NonFunctionalRequirementsContent {
  return {
    requirements: [
      {
        id: 'NFR-1',
        category: 'performance',
        title: 'Dashboard Page Load Performance',
        description:
          'The account dashboard must load within acceptable time thresholds for users on typical business internet connections.',
        acceptanceCriteria: [
          {
            id: 'NFR-1-AC-1',
            metric: 'Dashboard time-to-interactive (TTI) at p95',
            threshold: '< 3 seconds',
            measurement: 'Lighthouse CI run against staging with network throttled to Fast 3G',
          },
        ],
        tracesTo: [],
      },
      {
        id: 'NFR-2',
        category: 'security',
        title: 'Authentication and Session Security',
        description:
          'All sessions must be secured with industry-standard mechanisms. Sensitive operations require re-authentication.',
        acceptanceCriteria: [
          {
            id: 'NFR-2-AC-1',
            metric: 'Session token algorithm',
            threshold: 'RS256 JWT with 1-hour expiry',
            measurement: 'Code review and OWASP ZAP automated scan',
          },
        ],
        tracesTo: [
          { type: 'intent_brief', artifactId: 'pipeline-test-001', fieldPath: 'constraints.con-1' },
        ],
      },
    ],
  };
}

export function makeConstraintsAndAssumptionsContent(): ConstraintsAndAssumptionsContent {
  return {
    constraints: [
      {
        id: 'con-1',
        type: 'technical',
        description: 'Must integrate with existing SSO via SAML 2.0',
        impact:
          'All authentication flows must use the existing identity provider. Custom authentication cannot be implemented.',
      },
      {
        id: 'con-2',
        type: 'regulatory',
        description: 'Must comply with GDPR for EU customers',
        impact:
          'Personal data handling, consent management, and data deletion flows must be GDPR-compliant from day one.',
      },
    ],
    assumptions: [
      {
        id: 'ass-1',
        description: 'All customers already have active accounts in the system',
        riskIfWrong:
          'If any customer does not have an existing account, they will be unable to access the portal, requiring a registration flow that is currently out of scope.',
      },
      {
        id: 'ass-2',
        description: 'The SSO integration is stable and available during development',
        riskIfWrong:
          'If the SSO provider is unstable, authentication testing will be blocked, potentially delaying the launch timeline.',
      },
    ],
    dependencies: ['SSO / Identity Provider (SAML 2.0)', 'Email delivery service (SendGrid)'],
  };
}
