/**
 * PRD Generation types — Objective 22
 *
 * The PRD artifact and its 10 sections are the primary outputs of Stage 2.
 * Every downstream stage (design tokens, schema, UI generation, code, tests)
 * consumes the approved PRD.
 */

import { z } from 'zod';

import type { Artifact, ArtifactStatus, QualitySignals, ReasoningRecord } from '../types.js';

// ── Section type enum ─────────────────────────────────────────────────────────

/**
 * The 10 PRD sections. Locked per ADR-0166.
 * Downstream stages reference this enum — do not add/remove entries.
 */
export type PrdSectionType =
  | 'overview'
  | 'goals_and_success_metrics'
  | 'target_users_and_personas'
  | 'user_stories'
  | 'functional_requirements'
  | 'non_functional_requirements'
  | 'constraints_and_assumptions'
  | 'out_of_scope'
  | 'open_questions'
  | 'risks_and_mitigations';

export const PRD_SECTION_TYPES: readonly PrdSectionType[] = [
  'overview',
  'goals_and_success_metrics',
  'target_users_and_personas',
  'user_stories',
  'functional_requirements',
  'non_functional_requirements',
  'constraints_and_assumptions',
  'out_of_scope',
  'open_questions',
  'risks_and_mitigations',
] as const;

export const PrdSectionTypeSchema = z.enum([
  'overview',
  'goals_and_success_metrics',
  'target_users_and_personas',
  'user_stories',
  'functional_requirements',
  'non_functional_requirements',
  'constraints_and_assumptions',
  'out_of_scope',
  'open_questions',
  'risks_and_mitigations',
]);

// ── Traceability ──────────────────────────────────────────────────────────────

export interface TraceabilityRef {
  type: 'intent_brief' | 'prd_section' | 'requirement';
  /** Artifact ID of the source artifact. */
  artifactId: string;
  /** Dot-path into the artifact's content, e.g. "goals.goal-3". */
  fieldPath: string;
}

export const TraceabilityRefSchema = z.object({
  type: z.enum(['intent_brief', 'prd_section', 'requirement']),
  artifactId: z.string(),
  fieldPath: z.string(),
});

// ── Acceptance criteria ───────────────────────────────────────────────────────

/**
 * Gherkin-influenced format per ADR-0168. Required for every FunctionalRequirement.
 */
export interface AcceptanceCriterion {
  id: string; // e.g., 'AC-1', 'AC-2'
  given: string;
  when: string;
  then: string;
}

export const AcceptanceCriterionSchema = z.object({
  id: z.string(),
  given: z.string().min(1),
  when: z.string().min(1),
  then: z.string().min(1),
});

// ── Metric-based acceptance criteria (for NFRs) ────────────────────────────────

export interface MetricAcceptanceCriterion {
  id: string;
  metric: string;
  threshold: string;
  measurement?: string;
}

export const MetricAcceptanceCriterionSchema = z.object({
  id: z.string(),
  metric: z.string().min(1),
  threshold: z.string().min(1),
  measurement: z.string().optional(),
});

// ── Section content types ─────────────────────────────────────────────────────

// 1. Overview
export interface OverviewContent {
  summary: string;
  background: string;
  problemStatement: string;
  proposedSolution: string;
  keyBenefits: string[];
}

export const OverviewContentSchema = z.object({
  summary: z.string().min(1),
  background: z.string(),
  problemStatement: z.string().min(1),
  proposedSolution: z.string().min(1),
  keyBenefits: z.array(z.string()),
});

// 2. Goals and Success Metrics
export interface GoalEntry {
  id: string; // 'goal-1', 'goal-2', etc.
  description: string;
  priority: 'must' | 'should' | 'nice-to-have';
  successMetric: string;
  measurementMethod: string;
  tracesTo: TraceabilityRef[];
}

export interface GoalsAndSuccessMetricsContent {
  goals: GoalEntry[];
  overallSuccessCriteria: string;
}

export const GoalEntrySchema = z.object({
  id: z.string(),
  description: z.string().min(1),
  priority: z.enum(['must', 'should', 'nice-to-have']),
  successMetric: z.string().min(1),
  measurementMethod: z.string().min(1),
  tracesTo: z.array(TraceabilityRefSchema),
});

export const GoalsAndSuccessMetricsContentSchema = z.object({
  goals: z.array(GoalEntrySchema).min(1),
  overallSuccessCriteria: z.string().min(1),
});

// 3. Target Users and Personas
export interface PersonaEntry {
  id: string; // 'persona-1', etc.
  name: string;
  description: string;
  primaryGoals: string[];
  painPoints: string[];
  technicalProficiency: 'low' | 'medium' | 'high';
  frequency: 'daily' | 'weekly' | 'monthly' | 'occasional';
  tracesTo: TraceabilityRef[];
}

export interface TargetUsersContent {
  personas: PersonaEntry[];
  primaryPersona: string; // persona id
  marketSize?: string;
}

export const PersonaEntrySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().min(1),
  primaryGoals: z.array(z.string()),
  painPoints: z.array(z.string()),
  technicalProficiency: z.enum(['low', 'medium', 'high']),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'occasional']),
  tracesTo: z.array(TraceabilityRefSchema),
});

export const TargetUsersContentSchema = z.object({
  personas: z.array(PersonaEntrySchema).min(1),
  primaryPersona: z.string(),
  marketSize: z.string().optional(),
});

// 4. User Stories
export interface UserStory {
  id: string; // 'US-1', 'US-2', etc.
  persona: string; // persona id
  capability: string;
  benefit: string;
  /** "As a [persona], I want [capability], so that [benefit]" */
  formatted: string;
  acceptanceCriteria: AcceptanceCriterion[];
  priority: 'must' | 'should' | 'could' | 'wont';
  storyPoints?: number;
  tracesTo: TraceabilityRef[];
}

export interface UserStoriesContent {
  stories: UserStory[];
}

export const UserStorySchema = z.object({
  id: z.string(),
  persona: z.string(),
  capability: z.string().min(1),
  benefit: z.string().min(1),
  formatted: z.string().min(1),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema).min(1),
  priority: z.enum(['must', 'should', 'could', 'wont']),
  storyPoints: z.number().int().positive().optional(),
  tracesTo: z.array(TraceabilityRefSchema),
});

export const UserStoriesContentSchema = z.object({
  stories: z.array(UserStorySchema).min(1),
});

// 5. Functional Requirements
export interface FunctionalRequirement {
  id: string; // 'FR-1', 'FR-2', etc.
  title: string;
  description: string;
  priority: 'must' | 'should' | 'could' | 'wont';
  /** Every FR must have at least one acceptance criterion. */
  acceptanceCriteria: AcceptanceCriterion[];
  tracesTo: TraceabilityRef[];
  relatedStories?: string[]; // user story IDs
}

export interface FunctionalRequirementsContent {
  requirements: FunctionalRequirement[];
}

export const FunctionalRequirementSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['must', 'should', 'could', 'wont']),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema).min(1),
  tracesTo: z.array(TraceabilityRefSchema).min(1),
  relatedStories: z.array(z.string()).optional(),
});

export const FunctionalRequirementsContentSchema = z.object({
  requirements: z.array(FunctionalRequirementSchema).min(1),
});

// 6. Non-Functional Requirements
export type NfrCategory =
  | 'performance'
  | 'security'
  | 'scalability'
  | 'usability'
  | 'accessibility'
  | 'reliability'
  | 'maintainability'
  | 'portability';

export interface NonFunctionalRequirement {
  id: string; // 'NFR-1', 'NFR-2', etc.
  category: NfrCategory;
  title: string;
  description: string;
  acceptanceCriteria: MetricAcceptanceCriterion[];
  tracesTo: TraceabilityRef[];
}

export interface NonFunctionalRequirementsContent {
  requirements: NonFunctionalRequirement[];
}

export const NonFunctionalRequirementSchema = z.object({
  id: z.string(),
  category: z.enum([
    'performance',
    'security',
    'scalability',
    'usability',
    'accessibility',
    'reliability',
    'maintainability',
    'portability',
  ]),
  title: z.string().min(1),
  description: z.string().min(1),
  acceptanceCriteria: z.array(MetricAcceptanceCriterionSchema).min(1),
  tracesTo: z.array(TraceabilityRefSchema),
});

export const NonFunctionalRequirementsContentSchema = z.object({
  requirements: z.array(NonFunctionalRequirementSchema).min(1),
});

// 7. Constraints and Assumptions
export interface ConstraintEntry {
  id: string;
  type: 'technical' | 'business' | 'regulatory' | 'resource' | 'time';
  description: string;
  impact: string;
}

export interface AssumptionEntry {
  id: string;
  description: string;
  riskIfWrong: string;
}

export interface ConstraintsAndAssumptionsContent {
  constraints: ConstraintEntry[];
  assumptions: AssumptionEntry[];
  dependencies: string[];
}

export const ConstraintEntrySchema = z.object({
  id: z.string(),
  type: z.enum(['technical', 'business', 'regulatory', 'resource', 'time']),
  description: z.string().min(1),
  impact: z.string().min(1),
});

export const AssumptionEntrySchema = z.object({
  id: z.string(),
  description: z.string().min(1),
  riskIfWrong: z.string().min(1),
});

export const ConstraintsAndAssumptionsContentSchema = z.object({
  constraints: z.array(ConstraintEntrySchema),
  assumptions: z.array(AssumptionEntrySchema),
  dependencies: z.array(z.string()),
});

// 8. Out of Scope
export interface OutOfScopeItem {
  id: string;
  description: string;
  rationale: string;
  deferredTo?: string; // e.g., 'v2', 'Objective 25'
}

export interface OutOfScopeContent {
  items: OutOfScopeItem[];
  notes?: string;
}

export const OutOfScopeItemSchema = z.object({
  id: z.string(),
  description: z.string().min(1),
  rationale: z.string().min(1),
  deferredTo: z.string().optional(),
});

export const OutOfScopeContentSchema = z.object({
  items: z.array(OutOfScopeItemSchema),
  notes: z.string().optional(),
});

// 9. Open Questions
export interface OpenQuestion {
  id: string;
  question: string;
  context: string;
  owner?: string;
  dueDate?: string;
  status: 'open' | 'resolved' | 'deferred';
  resolution?: string;
  impact: 'blocking' | 'high' | 'medium' | 'low';
}

export interface OpenQuestionsContent {
  questions: OpenQuestion[];
}

export const OpenQuestionSchema = z.object({
  id: z.string(),
  question: z.string().min(1),
  context: z.string().min(1),
  owner: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.enum(['open', 'resolved', 'deferred']),
  resolution: z.string().optional(),
  impact: z.enum(['blocking', 'high', 'medium', 'low']),
});

export const OpenQuestionsContentSchema = z.object({
  questions: z.array(OpenQuestionSchema),
});

// 10. Risks and Mitigations
export interface RiskEntry {
  id: string;
  title: string;
  description: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high' | 'critical';
  /** Probability × impact rating. */
  riskScore: 'low' | 'medium' | 'high' | 'critical';
  mitigation: string;
  contingency?: string;
  owner?: string;
  relatedRequirements?: string[]; // FR/NFR IDs
}

export interface RisksAndMitigationsContent {
  risks: RiskEntry[];
  overallRiskRating: 'low' | 'medium' | 'high' | 'critical';
}

export const RiskEntrySchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  probability: z.enum(['low', 'medium', 'high']),
  impact: z.enum(['low', 'medium', 'high', 'critical']),
  riskScore: z.enum(['low', 'medium', 'high', 'critical']),
  mitigation: z.string().min(1),
  contingency: z.string().optional(),
  owner: z.string().optional(),
  relatedRequirements: z.array(z.string()).optional(),
});

export const RisksAndMitigationsContentSchema = z.object({
  risks: z.array(RiskEntrySchema),
  overallRiskRating: z.enum(['low', 'medium', 'high', 'critical']),
});

// ── Union content type ────────────────────────────────────────────────────────

export type PrdSectionContent =
  | OverviewContent
  | GoalsAndSuccessMetricsContent
  | TargetUsersContent
  | UserStoriesContent
  | FunctionalRequirementsContent
  | NonFunctionalRequirementsContent
  | ConstraintsAndAssumptionsContent
  | OutOfScopeContent
  | OpenQuestionsContent
  | RisksAndMitigationsContent;

// ── PRD Section ────────────────────────────────────────────────────────────────

export interface PrdSection {
  /** Artifact ID — each section is its own artifact. */
  id: string;
  /** Parent PRD artifact ID. */
  prdId: string;
  sectionType: PrdSectionType;
  status: ArtifactStatus;
  /** Monotonically increasing version (starts at 1). */
  version: number;
  content: PrdSectionContent;
  reasoning: ReasoningRecord;
  approvalId?: string;
  qualitySignals?: QualitySignals;
  createdAt: Date;
  updatedAt: Date;
}

// ── PRD Artifact content ───────────────────────────────────────────────────────

export interface PrdGenerationMetadata {
  totalGenerationTimeMs: number;
  totalCostUsd: number;
  sectionGenerationOrder: PrdSectionType[];
  templateUsed?: string;
  providersSummary: Record<string, number>; // provider → sections count
}

export interface PrdQualitySignals {
  prdId: string;
  sectionsAcceptedFirstPass: number;
  sectionsRejectedAtLeastOnce: number;
  totalSectionRevisions: number;
  consistencyIssuesFound: number;
  consistencyIssuesResolved: number;
  intentGoalsCovered: number;
  intentGoalsUncovered: number;
  totalGenerationTimeMinutes: number;
  totalApprovalTimeMinutes: number;
  causedDownstreamRejection: boolean;
}

export interface Prd {
  intentBriefId: string;
  templateUsed?: string;
  /** Map of section type → section artifact ID. */
  sectionIds: Record<PrdSectionType, string>;
  generationMetadata: PrdGenerationMetadata;
  consistencyReport?: ConsistencyReport;
  traceabilityReport?: TraceabilityReport;
  stalenessIndicators?: StalenessIndicator[];
  qualitySignals?: PrdQualitySignals;
}

// ── Reports ────────────────────────────────────────────────────────────────────

export interface ConsistencyIssue {
  id: string;
  severity: 'warning' | 'error';
  sections: PrdSectionType[];
  description: string;
  suggestion: string;
  resolved: boolean;
}

export interface ConsistencyReport {
  ranAt: Date;
  issues: ConsistencyIssue[];
  /** Overall health. true = no unresolved issues. */
  clean: boolean;
}

export interface TraceabilityGap {
  intentGoalId: string;
  intentGoalDescription: string;
  requirementCount: number;
}

export interface TraceabilityReport {
  ranAt: Date;
  totalIntentGoals: number;
  coveredGoals: number;
  gaps: TraceabilityGap[];
  /** true = all intent goals have at least one supporting requirement. */
  fullyCovered: boolean;
}

export interface StalenessIndicator {
  sectionType: PrdSectionType;
  sectionId: string;
  reason: string;
  changedIntentFields: string[];
}

// ── PRD Templates ─────────────────────────────────────────────────────────────

export interface PrdTemplate {
  id: string;
  workspaceId?: string; // undefined = built-in
  name: string;
  description: string;
  category: string;
  /** Section type → starter hints/emphasis for initial generation. */
  sectionStarters: Partial<Record<PrdSectionType, string>>;
  builtIn: boolean;
  createdByUserId?: string;
}

// ── Service input/output types ─────────────────────────────────────────────────

export interface GeneratePrdOptions {
  templateId?: string;
  /** Sections to generate (default: all 10 in dependency order). */
  sections?: PrdSectionType[];
  generationOptions?: {
    model?: string;
    maxTokens?: number;
  };
}

export interface SectionEdit {
  /** New content for this section. Must match the section type's structure. */
  content: PrdSectionContent;
  /** Reason for the edit (for audit). */
  reason?: string;
}

export interface StalenessReport {
  prdId: string;
  affectedSections: StalenessIndicator[];
  unaffectedSections: PrdSectionType[];
  changedIntentFields: string[];
}

// ── Zod input schemas ─────────────────────────────────────────────────────────

export const GeneratePrdInputSchema = z.object({
  intentBriefId: z.string().uuid(),
  templateId: z.string().optional(),
  sections: z.array(PrdSectionTypeSchema).optional(),
});

export const RegenerateSectionInputSchema = z.object({
  sectionId: z.string().uuid(),
  feedback: z.string().max(2000).optional(),
});

export const EditSectionInputSchema = z.object({
  sectionId: z.string().uuid(),
  content: z.record(z.unknown()), // validated per section type by service
  reason: z.string().max(500).optional(),
});

export const ExportPrdInputSchema = z.object({
  prdId: z.string().uuid(),
  format: z.enum(['markdown', 'pdf']),
});

export type GeneratePrdInput = z.infer<typeof GeneratePrdInputSchema>;
export type RegenerateSectionInput = z.infer<typeof RegenerateSectionInputSchema>;
export type EditSectionInput = z.infer<typeof EditSectionInputSchema>;
export type ExportPrdInput = z.infer<typeof ExportPrdInputSchema>;

// ── Artifact type alias ────────────────────────────────────────────────────────

export type PrdArtifact = Artifact<Prd>;
