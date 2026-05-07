'use client';

import type {
  PrdSectionType,
  PrdSectionContent,
  OverviewContent,
  GoalsAndSuccessMetricsContent,
  TargetUsersContent,
  UserStoriesContent,
  FunctionalRequirementsContent,
  NonFunctionalRequirementsContent,
  ConstraintsAndAssumptionsContent,
  OutOfScopeContent,
  OpenQuestionsContent,
  RisksAndMitigationsContent,
} from '@platform/core';

interface SectionMarkdownViewProps {
  content: PrdSectionContent;
  sectionType: PrdSectionType;
  editable: boolean;
  onChange: (raw: string) => void;
}

export function contentToMarkdown(sectionType: PrdSectionType, content: PrdSectionContent): string {
  try {
    switch (sectionType) {
      case 'overview': {
        const c = content as OverviewContent;
        return [
          `## Summary\n${c.summary}`,
          `## Background\n${c.background}`,
          `## Problem Statement\n${c.problemStatement}`,
          `## Proposed Solution\n${c.proposedSolution}`,
          `## Key Benefits\n${c.keyBenefits.map((b) => `- ${b}`).join('\n')}`,
        ].join('\n\n');
      }

      case 'goals_and_success_metrics': {
        const c = content as GoalsAndSuccessMetricsContent;
        const goalLines = c.goals
          .map(
            (g) =>
              `### ${g.id} — ${g.description}\n` +
              `- **Priority:** ${g.priority}\n` +
              `- **Success Metric:** ${g.successMetric}\n` +
              `- **Measurement:** ${g.measurementMethod}`,
          )
          .join('\n\n');
        return `## Goals\n\n${goalLines}\n\n## Overall Success Criteria\n${c.overallSuccessCriteria}`;
      }

      case 'target_users_and_personas': {
        const c = content as TargetUsersContent;
        const personaLines = c.personas
          .map(
            (p) =>
              `### ${p.name} (${p.id})${p.id === c.primaryPersona ? ' — Primary' : ''}\n` +
              `${p.description}\n\n` +
              `**Goals:** ${p.primaryGoals.join(', ')}\n` +
              (p.painPoints.length > 0 ? `**Pain Points:** ${p.painPoints.join(', ')}\n` : '') +
              `**Technical Proficiency:** ${p.technicalProficiency} | **Usage:** ${p.frequency}`,
          )
          .join('\n\n');
        return `## Personas\n\n${personaLines}${c.marketSize ? `\n\n## Market Size\n${c.marketSize}` : ''}`;
      }

      case 'user_stories': {
        const c = content as UserStoriesContent;
        const storyLines = c.stories
          .map(
            (s) =>
              `### ${s.id}\n${s.formatted}\n\n` +
              `**Priority:** ${s.priority}${s.storyPoints !== undefined ? ` | **Points:** ${s.storyPoints.toString()}` : ''}\n\n` +
              `**Acceptance Criteria:**\n` +
              s.acceptanceCriteria
                .map((ac) => `- **Given** ${ac.given} **When** ${ac.when} **Then** ${ac.then}`)
                .join('\n'),
          )
          .join('\n\n');
        return `## User Stories\n\n${storyLines}`;
      }

      case 'functional_requirements': {
        const c = content as FunctionalRequirementsContent;
        const reqLines = c.requirements
          .map(
            (r) =>
              `### ${r.id}: ${r.title}\n` +
              `**Priority:** ${r.priority}\n\n` +
              `${r.description}\n\n` +
              `**Acceptance Criteria:**\n` +
              r.acceptanceCriteria
                .map((ac) => `- **Given** ${ac.given} **When** ${ac.when} **Then** ${ac.then}`)
                .join('\n') +
              (r.relatedStories?.length
                ? `\n\n**Related Stories:** ${r.relatedStories.join(', ')}`
                : ''),
          )
          .join('\n\n');
        return `## Functional Requirements\n\n${reqLines}`;
      }

      case 'non_functional_requirements': {
        const c = content as NonFunctionalRequirementsContent;
        const nfrLines = c.requirements
          .map(
            (r) =>
              `### ${r.id}: ${r.title} (${r.category})\n` +
              `${r.description}\n\n` +
              `**Criteria:**\n` +
              r.acceptanceCriteria
                .map(
                  (ac) =>
                    `- ${ac.metric}: ${ac.threshold}${ac.measurement ? ` (${ac.measurement})` : ''}`,
                )
                .join('\n'),
          )
          .join('\n\n');
        return `## Non-Functional Requirements\n\n${nfrLines}`;
      }

      case 'constraints_and_assumptions': {
        const c = content as ConstraintsAndAssumptionsContent;
        const constraintLines = c.constraints
          .map((cc) => `- **${cc.id}** [${cc.type}]: ${cc.description}\n  *Impact: ${cc.impact}*`)
          .join('\n');
        const assumptionLines = c.assumptions
          .map((a) => `- **${a.id}**: ${a.description}\n  *Risk if wrong: ${a.riskIfWrong}*`)
          .join('\n');
        return (
          `## Constraints\n${constraintLines || '_None_'}` +
          `\n\n## Assumptions\n${assumptionLines || '_None_'}` +
          (c.dependencies.length
            ? `\n\n## Dependencies\n${c.dependencies.map((d) => `- ${d}`).join('\n')}`
            : '')
        );
      }

      case 'out_of_scope': {
        const c = content as OutOfScopeContent;
        const itemLines = c.items
          .map(
            (i) =>
              `- **${i.id}**: ${i.description}${i.deferredTo ? ` *(deferred to ${i.deferredTo})*` : ''}\n  ${i.rationale}`,
          )
          .join('\n');
        return `## Out of Scope\n${itemLines}${c.notes ? `\n\n_${c.notes}_` : ''}`;
      }

      case 'open_questions': {
        const c = content as OpenQuestionsContent;
        const qLines = c.questions
          .map(
            (q) =>
              `### ${q.id}: ${q.question}\n` +
              `**Status:** ${q.status} | **Impact:** ${q.impact}\n` +
              q.context +
              (q.owner ? `\n**Owner:** ${q.owner}` : '') +
              (q.resolution ? `\n**Resolution:** ${q.resolution}` : ''),
          )
          .join('\n\n');
        return `## Open Questions\n\n${qLines}`;
      }

      case 'risks_and_mitigations': {
        const c = content as RisksAndMitigationsContent;
        const riskLines = c.risks
          .map(
            (r) =>
              `### ${r.id}: ${r.title}\n` +
              `**Score:** ${r.riskScore} | **Probability:** ${r.probability} | **Impact:** ${r.impact}\n\n` +
              `${r.description}\n\n` +
              `**Mitigation:** ${r.mitigation}` +
              (r.contingency ? `\n**Contingency:** ${r.contingency}` : '') +
              (r.owner ? `\n**Owner:** ${r.owner}` : ''),
          )
          .join('\n\n');
        return `## Risks and Mitigations\n\n**Overall Risk:** ${c.overallRiskRating}\n\n${riskLines}`;
      }

      default:
        return JSON.stringify(content, null, 2);
    }
  } catch {
    return JSON.stringify(content, null, 2);
  }
}

export function SectionMarkdownView({
  content,
  sectionType,
  editable,
  onChange,
}: SectionMarkdownViewProps) {
  const markdown = contentToMarkdown(sectionType, content);

  if (editable) {
    return (
      <textarea
        className="h-full w-full resize-none bg-background px-4 py-3 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        value={markdown}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        aria-label="Section markdown editor"
        spellCheck={false}
      />
    );
  }

  return (
    <pre className="h-full w-full overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-sm text-foreground">
      {markdown}
    </pre>
  );
}
