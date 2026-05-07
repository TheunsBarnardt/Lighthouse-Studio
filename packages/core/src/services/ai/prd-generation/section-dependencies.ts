/**
 * PRD section dependency graph — Objective 22, Section 6.4
 *
 * Defines which sections must complete before another can start.
 * The orchestrator uses this to run sections in topological order,
 * maximising parallel generation while respecting data dependencies.
 */

import type { PrdSectionType } from './types.js';

/**
 * Adjacency list: sectionType → sections it depends on.
 * Sections with an empty array have no dependencies and can run in parallel
 * immediately.
 */
export const SECTION_DEPENDENCIES: Record<PrdSectionType, PrdSectionType[]> = {
  overview: [],
  goals_and_success_metrics: [],
  target_users_and_personas: [],
  user_stories: ['target_users_and_personas', 'goals_and_success_metrics'],
  functional_requirements: ['user_stories'],
  non_functional_requirements: ['functional_requirements'],
  constraints_and_assumptions: [],
  out_of_scope: ['functional_requirements'],
  open_questions: ['functional_requirements', 'non_functional_requirements'],
  risks_and_mitigations: [
    'functional_requirements',
    'non_functional_requirements',
    'constraints_and_assumptions',
  ],
};

/**
 * Returns sections in topological order for sequential generation.
 * Groups sections that can run in parallel at each "wave".
 */
export function getGenerationWaves(
  sections: PrdSectionType[] = Object.keys(SECTION_DEPENDENCIES) as PrdSectionType[],
): PrdSectionType[][] {
  const sectionSet = new Set(sections);
  const deps = Object.fromEntries(
    sections.map((s) => [s, SECTION_DEPENDENCIES[s].filter((d) => sectionSet.has(d))]),
  ) as Record<PrdSectionType, PrdSectionType[]>;

  const resolved = new Set<PrdSectionType>();
  const waves: PrdSectionType[][] = [];

  let remaining = sections.filter((s) => sectionSet.has(s));

  while (remaining.length > 0) {
    const wave = remaining.filter((s) => deps[s].every((d) => resolved.has(d)));

    if (wave.length === 0) {
      // Cycle detection — should never happen with the locked dependency graph
      throw new Error(
        `Cycle detected in PRD section dependencies. Remaining: ${remaining.join(', ')}`,
      );
    }

    waves.push(wave);
    for (const s of wave) resolved.add(s);
    remaining = remaining.filter((s) => !resolved.has(s));
  }

  return waves;
}

/**
 * Returns the flat topological order (for single-threaded generation fallback).
 */
export function getTopologicalOrder(
  sections: PrdSectionType[] = Object.keys(SECTION_DEPENDENCIES) as PrdSectionType[],
): PrdSectionType[] {
  return getGenerationWaves(sections).flat();
}

/**
 * Returns all sections that depend (directly or transitively) on the given
 * section. Used by staleness detection to identify which sections to
 * re-generate when a dependency changes.
 */
export function getDependents(sectionType: PrdSectionType): PrdSectionType[] {
  const dependents: PrdSectionType[] = [];
  const all = Object.keys(SECTION_DEPENDENCIES) as PrdSectionType[];

  function walk(target: PrdSectionType): void {
    for (const s of all) {
      if (SECTION_DEPENDENCIES[s].includes(target) && !dependents.includes(s)) {
        dependents.push(s);
        walk(s);
      }
    }
  }

  walk(sectionType);
  return dependents;
}
