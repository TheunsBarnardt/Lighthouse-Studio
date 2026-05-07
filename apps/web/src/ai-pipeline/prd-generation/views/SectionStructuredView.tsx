'use client';

import type {
  PrdSectionType,
  PrdSectionContent,
  FunctionalRequirementsContent,
  UserStoriesContent,
  NonFunctionalRequirementsContent,
  OverviewContent,
  GoalsAndSuccessMetricsContent,
  TargetUsersContent,
  ConstraintsAndAssumptionsContent,
  OutOfScopeContent,
  OpenQuestionsContent,
  RisksAndMitigationsContent,
} from '@platform/core';

import { RequirementCard } from './RequirementCard.js';
import { UserStoryCard } from './UserStoryCard.js';

const NFR_CATEGORY_COLORS: Record<string, string> = {
  performance: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  security: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  scalability: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  usability: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  accessibility: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  reliability: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  maintainability: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  portability: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

const IMPACT_COLORS: Record<string, string> = {
  blocking: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  low: 'bg-muted text-muted-foreground',
};

const RISK_SCORE_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-muted text-muted-foreground',
};

interface SectionStructuredViewProps {
  sectionType: PrdSectionType;
  content: PrdSectionContent;
  editable: boolean;
  onChange: (c: PrdSectionContent) => void;
}

export function SectionStructuredView({
  sectionType,
  content,
  editable,
  onChange,
}: SectionStructuredViewProps) {
  switch (sectionType) {
    case 'overview':
      return (
        <OverviewView
          content={content as OverviewContent}
          editable={editable}
          onChange={(c) => {
            onChange(c);
          }}
        />
      );

    case 'goals_and_success_metrics':
      return <GoalsView content={content as GoalsAndSuccessMetricsContent} />;

    case 'target_users_and_personas':
      return <PersonasView content={content as TargetUsersContent} />;

    case 'user_stories':
      return (
        <UserStoriesView
          content={content as UserStoriesContent}
          editable={editable}
          onChange={(c) => {
            onChange(c);
          }}
        />
      );

    case 'functional_requirements':
      return (
        <FunctionalRequirementsView
          content={content as FunctionalRequirementsContent}
          editable={editable}
          onChange={(c) => {
            onChange(c);
          }}
        />
      );

    case 'non_functional_requirements':
      return <NfrView content={content as NonFunctionalRequirementsContent} />;

    case 'constraints_and_assumptions':
      return <ConstraintsView content={content as ConstraintsAndAssumptionsContent} />;

    case 'out_of_scope':
      return <OutOfScopeView content={content as OutOfScopeContent} />;

    case 'open_questions':
      return <OpenQuestionsView content={content as OpenQuestionsContent} />;

    case 'risks_and_mitigations':
      return <RisksView content={content as RisksAndMitigationsContent} />;

    default:
      return (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          No structured view available for this section type.
        </div>
      );
  }
}

// ── Section-specific views ─────────────────────────────────────────────────────

function OverviewView({
  content,
  editable,
  onChange,
}: {
  content: OverviewContent;
  editable: boolean;
  onChange: (c: OverviewContent) => void;
}) {
  const field = (label: string, key: keyof OverviewContent, multiline = true) => {
    const value = content[key];
    if (!multiline || !editable) {
      return (
        <div key={key}>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </h4>
          {editable ? (
            <textarea
              className="w-full rounded border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              rows={3}
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => {
                onChange({ ...content, [key]: e.target.value });
              }}
              aria-label={label}
            />
          ) : (
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {typeof value === 'string' ? value : ''}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 p-1">
      {field('Summary', 'summary')}
      {field('Background', 'background')}
      {field('Problem Statement', 'problemStatement')}
      {field('Proposed Solution', 'proposedSolution')}
      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Key Benefits
        </h4>
        <ul className="space-y-1 list-disc list-inside">
          {content.keyBenefits.map((b, i) => (
            <li key={i} className="text-sm text-foreground">
              {b}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function GoalsView({ content }: { content: GoalsAndSuccessMetricsContent }) {
  const PRIORITY_COLORS = {
    must: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    should: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'nice-to-have': 'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-6 p-1">
      <div className="space-y-3">
        {content.goals.map((goal) => (
          <div key={goal.id} className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-start gap-3">
              <span className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                {goal.id}
              </span>
              <p className="flex-1 text-sm text-foreground">{goal.description}</p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[goal.priority]}`}
              >
                {goal.priority}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Success Metric</p>
                <p className="text-sm text-foreground">{goal.successMetric}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Measurement Method</p>
                <p className="text-sm text-foreground">{goal.measurementMethod}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      {content.overallSuccessCriteria && (
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Overall Success Criteria
          </h4>
          <p className="text-sm text-foreground">{content.overallSuccessCriteria}</p>
        </div>
      )}
    </div>
  );
}

function PersonasView({ content }: { content: TargetUsersContent }) {
  const PROFICIENCY_COLORS = {
    low: 'bg-muted text-muted-foreground',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };

  return (
    <div className="space-y-4 p-1">
      {content.marketSize && (
        <div className="rounded-lg border bg-muted/30 px-4 py-2">
          <span className="text-xs font-medium text-muted-foreground">Market Size: </span>
          <span className="text-sm text-foreground">{content.marketSize}</span>
        </div>
      )}
      {content.personas.map((persona) => (
        <div key={persona.id} className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
              {persona.id}
            </span>
            <p className="flex-1 font-medium text-foreground">{persona.name}</p>
            {persona.id === content.primaryPersona && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Primary
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PROFICIENCY_COLORS[persona.technicalProficiency]}`}
            >
              {persona.technicalProficiency} technical
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{persona.description}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Primary Goals</p>
              <ul className="space-y-0.5 list-disc list-inside">
                {persona.primaryGoals.map((g, i) => (
                  <li key={i} className="text-xs text-foreground">
                    {g}
                  </li>
                ))}
              </ul>
            </div>
            {persona.painPoints.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Pain Points</p>
                <ul className="space-y-0.5 list-disc list-inside">
                  {persona.painPoints.map((p, i) => (
                    <li key={i} className="text-xs text-foreground">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Usage frequency: <span className="capitalize text-foreground">{persona.frequency}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

function UserStoriesView({
  content,
  editable,
  onChange,
}: {
  content: UserStoriesContent;
  editable: boolean;
  onChange: (c: UserStoriesContent) => void;
}) {
  void onChange;
  return (
    <div className="space-y-3 p-1">
      {content.stories.map((story) => (
        <UserStoryCard key={story.id} story={story} editable={editable} />
      ))}
    </div>
  );
}

function FunctionalRequirementsView({
  content,
  editable,
  onChange,
}: {
  content: FunctionalRequirementsContent;
  editable: boolean;
  onChange: (c: FunctionalRequirementsContent) => void;
}) {
  const handleChange = (updated: Parameters<typeof RequirementCard>[0]['requirement']) => {
    onChange({
      ...content,
      requirements: content.requirements.map((r) => (r.id === updated.id ? updated : r)),
    });
  };

  return (
    <div className="space-y-3 p-1">
      {content.requirements.map((req) => (
        <RequirementCard
          key={req.id}
          requirement={req}
          editable={editable}
          onChange={handleChange}
        />
      ))}
    </div>
  );
}

function NfrView({ content }: { content: NonFunctionalRequirementsContent }) {
  // Group by category
  const byCategory = content.requirements.reduce<Record<string, typeof content.requirements>>(
    (acc, r) => {
      const cat = r.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(r);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-5 p-1">
      {Object.entries(byCategory).map(([category, reqs]) => (
        <div key={category}>
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${NFR_CATEGORY_COLORS[category] ?? 'bg-muted text-muted-foreground'}`}
            >
              {category}
            </span>
          </div>
          <div className="space-y-3">
            {reqs.map((nfr) => (
              <div key={nfr.id} className="rounded-lg border bg-card p-4 space-y-2">
                <div className="flex items-start gap-3">
                  <span className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                    {nfr.id}
                  </span>
                  <p className="flex-1 text-sm font-medium text-foreground">{nfr.title}</p>
                </div>
                <p className="text-sm text-muted-foreground">{nfr.description}</p>
                {nfr.acceptanceCriteria.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {nfr.acceptanceCriteria.map((ac) => (
                      <div
                        key={ac.id}
                        className="rounded bg-muted/50 p-2 text-xs flex items-baseline gap-2"
                      >
                        <span className="text-muted-foreground">{ac.metric}</span>
                        <span className="font-mono text-foreground">{ac.threshold}</span>
                        {ac.measurement && (
                          <span className="text-muted-foreground">— {ac.measurement}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConstraintsView({ content }: { content: ConstraintsAndAssumptionsContent }) {
  const CONSTRAINT_TYPE_COLORS: Record<string, string> = {
    technical: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    business: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    regulatory: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    resource: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    time: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  };

  return (
    <div className="space-y-6 p-1">
      {content.constraints.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Constraints
          </h4>
          <div className="space-y-2">
            {content.constraints.map((c) => (
              <div key={c.id} className="rounded-lg border bg-card p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${CONSTRAINT_TYPE_COLORS[c.type] ?? 'bg-muted text-muted-foreground'}`}
                  >
                    {c.type}
                  </span>
                </div>
                <p className="text-sm text-foreground">{c.description}</p>
                <p className="text-xs text-muted-foreground">Impact: {c.impact}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.assumptions.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Assumptions
          </h4>
          <div className="space-y-2">
            {content.assumptions.map((a) => (
              <div key={a.id} className="rounded-lg border bg-card p-3 space-y-1">
                <span className="font-mono text-xs text-muted-foreground">{a.id}</span>
                <p className="text-sm text-foreground">{a.description}</p>
                <p className="text-xs text-muted-foreground">Risk if wrong: {a.riskIfWrong}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {content.dependencies.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dependencies
          </h4>
          <ul className="space-y-1 list-disc list-inside">
            {content.dependencies.map((d, i) => (
              <li key={i} className="text-sm text-foreground">
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function OutOfScopeView({ content }: { content: OutOfScopeContent }) {
  return (
    <div className="space-y-4 p-1">
      {content.notes && (
        <p className="rounded bg-muted/50 px-3 py-2 text-sm text-muted-foreground italic">
          {content.notes}
        </p>
      )}
      <div className="space-y-2">
        {content.items.map((item) => (
          <div key={item.id} className="rounded-lg border bg-card p-3 space-y-1">
            <div className="flex items-start gap-2">
              <span className="font-mono text-xs text-muted-foreground">{item.id}</span>
              <p className="flex-1 text-sm font-medium text-foreground">{item.description}</p>
              {item.deferredTo && (
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {item.deferredTo}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{item.rationale}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OpenQuestionsView({ content }: { content: OpenQuestionsContent }) {
  const STATUS_COLORS = {
    open: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    resolved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    deferred: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-3 p-1">
      {content.questions.map((q) => (
        <div key={q.id} className="rounded-lg border bg-card p-4 space-y-2">
          <div className="flex items-start gap-3">
            <span className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
              {q.id}
            </span>
            <p className="flex-1 text-sm font-medium text-foreground">{q.question}</p>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[q.status]}`}
            >
              {q.status}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${IMPACT_COLORS[q.impact] ?? 'bg-muted text-muted-foreground'}`}
            >
              {q.impact}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{q.context}</p>
          {q.owner && (
            <p className="text-xs text-muted-foreground">
              Owner: <span className="text-foreground">{q.owner}</span>
              {q.dueDate && <span className="ml-2 text-muted-foreground">Due: {q.dueDate}</span>}
            </p>
          )}
          {q.resolution && (
            <div className="rounded bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-900/20 dark:text-green-400">
              Resolution: {q.resolution}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RisksView({ content }: { content: RisksAndMitigationsContent }) {
  const OVERALL_COLORS = {
    low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <div className="space-y-4 p-1">
      <div
        className={`flex items-center gap-2 rounded-lg px-3 py-2 ${OVERALL_COLORS[content.overallRiskRating]}`}
      >
        <span className="text-xs font-semibold uppercase tracking-wide">Overall Risk:</span>
        <span className="text-sm font-medium capitalize">{content.overallRiskRating}</span>
      </div>

      <div className="space-y-3">
        {content.risks.map((risk) => (
          <div key={risk.id} className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-start gap-3">
              <span className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                {risk.id}
              </span>
              <p className="flex-1 text-sm font-medium text-foreground">{risk.title}</p>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${RISK_SCORE_COLORS[risk.riskScore] ?? 'bg-muted text-muted-foreground'}`}
              >
                {risk.riskScore} risk
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{risk.description}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span className="text-muted-foreground">
                Probability: <span className="capitalize text-foreground">{risk.probability}</span>
              </span>
              <span className="text-muted-foreground">
                Impact: <span className="capitalize text-foreground">{risk.impact}</span>
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Mitigation</p>
              <p className="text-sm text-foreground">{risk.mitigation}</p>
            </div>
            {risk.contingency && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Contingency</p>
                <p className="text-sm text-foreground">{risk.contingency}</p>
              </div>
            )}
            {risk.owner && (
              <p className="text-xs text-muted-foreground">
                Owner: <span className="text-foreground">{risk.owner}</span>
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
