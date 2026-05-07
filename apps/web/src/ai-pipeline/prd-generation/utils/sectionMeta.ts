import type { PrdSectionType } from '@platform/core';

import { PRD_SECTION_TYPES } from '@platform/core';

export const SECTION_DISPLAY_NAMES: Record<PrdSectionType, string> = {
  overview: 'Overview',
  goals_and_success_metrics: 'Goals & Success Metrics',
  target_users_and_personas: 'Target Users & Personas',
  user_stories: 'User Stories',
  functional_requirements: 'Functional Requirements',
  non_functional_requirements: 'Non-Functional Requirements',
  constraints_and_assumptions: 'Constraints & Assumptions',
  out_of_scope: 'Out of Scope',
  open_questions: 'Open Questions',
  risks_and_mitigations: 'Risks & Mitigations',
};

export { PRD_SECTION_TYPES };
