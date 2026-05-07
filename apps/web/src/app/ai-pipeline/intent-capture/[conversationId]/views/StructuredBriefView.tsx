'use client';

import type {
  Assumption,
  Constraint,
  Goal,
  IntentBrief,
  Risk,
  SuccessCriterion,
  TargetUser,
} from '@platform/core';

// ── Priority badge ─────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: Goal['priority'] }) {
  const map: Record<Goal['priority'], { label: string; className: string }> = {
    must_have: {
      label: 'Must',
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    },
    should_have: {
      label: 'Should',
      className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    nice_to_have: {
      label: 'Nice',
      className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    },
  };
  const { label, className } = map[priority];
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${className}`}>{label}</span>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {title}
      </h3>
      <div>{children}</div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="text-xs text-gray-400 dark:text-gray-600 italic">{label}</p>;
}

// ── Field components ──────────────────────────────────────────────────────────

function GoalsList({ goals }: { goals: Goal[] }) {
  if (goals.length === 0) return <EmptyState label="No goals captured yet." />;
  return (
    <ul className="space-y-2">
      {goals.map((g) => (
        <li key={g.id} className="flex items-start gap-2 text-sm">
          <PriorityBadge priority={g.priority} />
          <div>
            <p className="text-gray-900 dark:text-gray-100">{g.description}</p>
            {g.acceptanceCriteria.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {g.acceptanceCriteria.map((ac, i) => (
                  <li key={i} className="text-xs text-gray-500 dark:text-gray-400 flex gap-1">
                    <span className="shrink-0">•</span>
                    <span>{ac}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function TargetUsersList({ users }: { users: TargetUser[] }) {
  if (users.length === 0) return <EmptyState label="No target users captured yet." />;
  return (
    <ul className="space-y-3">
      {users.map((u) => (
        <li key={u.id} className="border border-gray-100 dark:border-gray-800 rounded-lg p-3">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{u.persona}</p>
          {u.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{u.description}</p>
          )}
          {u.needs.length > 0 && (
            <div className="mt-1.5">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Needs</p>
              <ul className="space-y-0.5">
                {u.needs.map((n, i) => (
                  <li key={i} className="text-xs text-gray-700 dark:text-gray-300 flex gap-1">
                    <span className="shrink-0 text-gray-400">•</span>
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {u.painPoints.length > 0 && (
            <div className="mt-1.5">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                Pain points
              </p>
              <ul className="space-y-0.5">
                {u.painPoints.map((p, i) => (
                  <li key={i} className="text-xs text-gray-700 dark:text-gray-300 flex gap-1">
                    <span className="shrink-0 text-gray-400">•</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function SuccessCriteriaList({ criteria }: { criteria: SuccessCriterion[] }) {
  if (criteria.length === 0) return <EmptyState label="No success criteria captured yet." />;
  return (
    <ul className="space-y-1.5">
      {criteria.map((sc) => (
        <li key={sc.id} className="text-sm text-gray-800 dark:text-gray-200 flex items-start gap-2">
          <span className="shrink-0 text-gray-400 mt-0.5">✓</span>
          <span>
            {sc.description}
            {sc.metric && (
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                ({sc.metric}
                {sc.target ? ` → ${sc.target}` : ''})
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ScopeList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) return <EmptyState label={emptyLabel} />;
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-gray-800 dark:text-gray-200 flex gap-2">
          <span className="shrink-0 text-gray-400">•</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

function ConstraintsList({ constraints }: { constraints: Constraint[] }) {
  if (constraints.length === 0) return <EmptyState label="No constraints captured yet." />;
  return (
    <ul className="space-y-1.5">
      {constraints.map((c) => (
        <li key={c.id} className="flex items-start gap-2 text-sm">
          <span
            className={`shrink-0 mt-0.5 text-xs px-1 py-0.5 rounded ${c.severity === 'hard' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
          >
            {c.severity === 'hard' ? 'Hard' : 'Soft'}
          </span>
          <span className="text-gray-800 dark:text-gray-200">
            {c.description}
            <span className="text-xs text-gray-400 ml-1">({c.type})</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function AssumptionsList({ assumptions }: { assumptions: Assumption[] }) {
  if (assumptions.length === 0) return <EmptyState label="No assumptions captured yet." />;
  return (
    <ul className="space-y-1.5">
      {assumptions.map((a) => (
        <li key={a.id} className="flex items-start gap-2 text-sm">
          <span
            className={`shrink-0 mt-0.5 text-xs px-1 py-0.5 rounded ${a.impact === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : a.impact === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}
          >
            {a.impact}
          </span>
          <span className="text-gray-800 dark:text-gray-200">{a.description}</span>
        </li>
      ))}
    </ul>
  );
}

function RisksList({ risks }: { risks: Risk[] }) {
  if (risks.length === 0) return <EmptyState label="No risks captured yet." />;
  return (
    <ul className="space-y-2">
      {risks.map((r) => (
        <li key={r.id} className="border border-gray-100 dark:border-gray-800 rounded-lg p-2.5">
          <div className="flex items-start gap-2">
            <span
              className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${r.likelihood === 'high' ? 'bg-red-500' : r.likelihood === 'medium' ? 'bg-yellow-500' : 'bg-gray-400'}`}
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-100">{r.description}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Likelihood: {r.likelihood} · Impact: {r.impact}
              </p>
              {r.mitigationIdea && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">
                  Mitigation: {r.mitigationIdea}
                </p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface StructuredBriefViewProps {
  brief: IntentBrief;
  /** Called when the user edits a field. Not yet implemented — accepted for interface parity with MarkdownBriefView. */
  onUpdate: (updates: Partial<IntentBrief>) => void;
}

// onUpdate is intentionally unused in this read-only first implementation.
// Inline field editing is a planned enhancement; see Objective 21 §5.5.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function StructuredBriefView({ brief, onUpdate }: StructuredBriefViewProps) {
  return (
    <div className="flex flex-col gap-6 p-4 overflow-y-auto h-full">
      {/* Title & summary */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {brief.title || <span className="text-gray-400 italic">Untitled Brief</span>}
        </h2>
        {brief.summary && (
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{brief.summary}</p>
        )}
        {brief.estimatedScope && (
          <span className="mt-2 inline-block text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-full">
            {brief.estimatedScope} scope
          </span>
        )}
      </div>

      <Section title="Goals">
        <GoalsList goals={brief.goals} />
      </Section>

      <Section title="Target Users">
        <TargetUsersList users={brief.targetUsers} />
      </Section>

      <Section title="Success Criteria">
        <SuccessCriteriaList criteria={brief.successCriteria} />
      </Section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Section title="In Scope">
          <ScopeList items={brief.inScope} emptyLabel="Not yet defined." />
        </Section>
        <Section title="Out of Scope">
          <ScopeList items={brief.outOfScope} emptyLabel="Not yet defined." />
        </Section>
      </div>

      {brief.constraints.length > 0 && (
        <Section title="Constraints">
          <ConstraintsList constraints={brief.constraints} />
        </Section>
      )}

      {brief.assumptions.length > 0 && (
        <Section title="Assumptions">
          <AssumptionsList assumptions={brief.assumptions} />
        </Section>
      )}

      {brief.risks.length > 0 && (
        <Section title="Risks">
          <RisksList risks={brief.risks} />
        </Section>
      )}
    </div>
  );
}
