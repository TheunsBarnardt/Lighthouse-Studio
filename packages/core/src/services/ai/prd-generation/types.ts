import { z } from 'zod';

// ── Section types ────────────────────────────────────────────────────────────

export const PRD_SECTION_TYPES = [
  'purpose',
  'scope',
  'locked_decisions',
  'architectural_overview',
  'hard_parts',
  'component_specifications',
  'implementation_order',
  'adrs_to_write',
  'verification_steps',
  'definition_of_done',
  'anti_patterns',
  'open_questions',
  'what_comes_next',
] as const;

export type PrdSectionType = (typeof PRD_SECTION_TYPES)[number];

// ── Shared primitives ────────────────────────────────────────────────────────

export const TraceabilityRefSchema = z.object({
  type: z.enum(['intent_brief', 'prd_section', 'requirement']),
  artifactId: z.string(),
  fieldPath: z.string(), // e.g. "goals.goal-3", "user_stories.US-12"
});
export type TraceabilityRef = z.infer<typeof TraceabilityRefSchema>;

export const AcceptanceCriterionSchema = z.object({
  given: z.string(),
  when: z.string(),
  then: z.string(),
});
export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;

export const FunctionalRequirementSchema = z.object({
  id: z.string(), // FR-1, FR-2, …
  title: z.string(),
  description: z.string(),
  priority: z.enum(['must', 'should', 'could', 'wont']),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema).min(1),
  tracesTo: z.array(TraceabilityRefSchema),
});
export type FunctionalRequirement = z.infer<typeof FunctionalRequirementSchema>;

export const NfrCriterionSchema = z.object({
  metric: z.string(),
  threshold: z.string(),
  measurement: z.string().optional(),
});

export const NonFunctionalRequirementSchema = z.object({
  id: z.string(), // NFR-1, NFR-2, …
  category: z.enum(['performance', 'security', 'scalability', 'usability', 'accessibility', 'reliability', 'maintainability']),
  description: z.string(),
  acceptanceCriteria: z.array(NfrCriterionSchema),
  tracesTo: z.array(TraceabilityRefSchema),
});
export type NonFunctionalRequirement = z.infer<typeof NonFunctionalRequirementSchema>;

// ── Section content schemas ──────────────────────────────────────────────────

export const PurposeContentSchema = z.object({
  narrative: z.string().min(50),
  problemStatement: z.string(),
  solutionOverview: z.string(),
});
export type PurposeContent = z.infer<typeof PurposeContentSchema>;

export const ScopeContentSchema = z.object({
  inScope: z.array(z.string()).min(1),
  outOfScope: z.array(z.string()),
  estimatedSize: z.enum(['small', 'medium', 'large', 'xl']).optional(),
  assumptions: z.array(z.string()),
});
export type ScopeContent = z.infer<typeof ScopeContentSchema>;

export const LockedDecisionSchema = z.object({
  decision: z.string(),
  choice: z.string(),
  rationale: z.string(),
  tracesTo: z.array(TraceabilityRefSchema),
});
export type LockedDecision = z.infer<typeof LockedDecisionSchema>;

export const LockedDecisionsContentSchema = z.object({
  decisions: z.array(LockedDecisionSchema).min(1),
});
export type LockedDecisionsContent = z.infer<typeof LockedDecisionsContentSchema>;

export const ArchitecturalOverviewContentSchema = z.object({
  narrative: z.string().min(50),
  diagram: z.string(), // mermaid or ASCII
  components: z.array(z.object({ name: z.string(), role: z.string() })),
});
export type ArchitecturalOverviewContent = z.infer<typeof ArchitecturalOverviewContentSchema>;

export const HardPartSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  whyHard: z.string(),
  proposedApproach: z.string(),
});
export type HardPart = z.infer<typeof HardPartSchema>;

export const HardPartsContentSchema = z.object({
  items: z.array(HardPartSchema).min(1),
});
export type HardPartsContent = z.infer<typeof HardPartsContentSchema>;

export const ComponentSpecSchema = z.object({
  name: z.string(),
  type: z.string(), // 'service', 'model', 'component', 'api', etc.
  description: z.string(),
  interfaceStub: z.string().optional(), // TypeScript interface or type stub
  dependsOn: z.array(z.string()),
});
export type ComponentSpec = z.infer<typeof ComponentSpecSchema>;

export const ComponentSpecificationsContentSchema = z.object({
  components: z.array(ComponentSpecSchema).min(1),
});
export type ComponentSpecificationsContent = z.infer<typeof ComponentSpecificationsContentSchema>;

export const ImplementationStepSchema = z.object({
  step: z.number(),
  title: z.string(),
  description: z.string(),
  dependsOnSteps: z.array(z.number()),
  estimatedComplexity: z.enum(['low', 'medium', 'high']).optional(),
});
export type ImplementationStep = z.infer<typeof ImplementationStepSchema>;

export const ImplementationOrderContentSchema = z.object({
  steps: z.array(ImplementationStepSchema).min(1),
});
export type ImplementationOrderContent = z.infer<typeof ImplementationOrderContentSchema>;

export const AdrStubSchema = z.object({
  number: z.string().optional(), // e.g. "0001" — seeded by Stage 7
  title: z.string(),
  context: z.string(),
  rationaleSummary: z.string(),
});
export type AdrStub = z.infer<typeof AdrStubSchema>;

export const AdrsToWriteContentSchema = z.object({
  adrs: z.array(AdrStubSchema).min(1),
});
export type AdrsToWriteContent = z.infer<typeof AdrsToWriteContentSchema>;

export const VerificationStepSchema = z.object({
  step: z.number(),
  description: z.string(),
  expectedOutcome: z.string(),
  category: z.enum(['functional', 'performance', 'security', 'accessibility', 'cross-browser', 'other']),
});
export type VerificationStep = z.infer<typeof VerificationStepSchema>;

export const VerificationStepsContentSchema = z.object({
  steps: z.array(VerificationStepSchema).min(1),
});
export type VerificationStepsContent = z.infer<typeof VerificationStepsContentSchema>;

export const DodItemSchema = z.object({
  id: z.string(),
  category: z.string(), // 'Schema', 'Service Layer', 'UI', 'Permissions', etc.
  description: z.string(),
  stage: z.enum(['4', '5', '6', '7', '8', '9', 'any']).optional(),
});
export type DodItem = z.infer<typeof DodItemSchema>;

export const DefinitionOfDoneContentSchema = z.object({
  items: z.array(DodItemSchema).min(1),
});
export type DefinitionOfDoneContent = z.infer<typeof DefinitionOfDoneContentSchema>;

export const AntiPatternSchema = z.object({
  id: z.string(),
  rule: z.string(), // "we don't do X"
  rationale: z.string(),
});
export type AntiPattern = z.infer<typeof AntiPatternSchema>;

export const AntiPatternsContentSchema = z.object({
  antiPatterns: z.array(AntiPatternSchema).min(1),
});
export type AntiPatternsContent = z.infer<typeof AntiPatternsContentSchema>;

export const OpenQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  impact: z.enum(['high', 'medium', 'low']),
  resolvedBy: z.string().optional(), // e.g. "Stage 4", "stakeholder review"
});
export type OpenQuestion = z.infer<typeof OpenQuestionSchema>;

export const OpenQuestionsContentSchema = z.object({
  questions: z.array(OpenQuestionSchema),
});
export type OpenQuestionsContent = z.infer<typeof OpenQuestionsContentSchema>;

export const WhatComesNextContentSchema = z.object({
  narrative: z.string().min(20),
  nextStage: z.string(),
  dependenciesForNextStage: z.array(z.string()),
});
export type WhatComesNextContent = z.infer<typeof WhatComesNextContentSchema>;

// ── Section union ────────────────────────────────────────────────────────────

export type PrdSectionContent =
  | PurposeContent
  | ScopeContent
  | LockedDecisionsContent
  | ArchitecturalOverviewContent
  | HardPartsContent
  | ComponentSpecificationsContent
  | ImplementationOrderContent
  | AdrsToWriteContent
  | VerificationStepsContent
  | DefinitionOfDoneContent
  | AntiPatternsContent
  | OpenQuestionsContent
  | WhatComesNextContent;

// ── Section ──────────────────────────────────────────────────────────────────

export type SectionStatus = 'pending' | 'generating' | 'draft' | 'awaiting_approval' | 'approved' | 'rejected';

export interface PrdSection {
  id: string;
  prdId: string;
  sectionType: PrdSectionType;
  status: SectionStatus;
  currentVersion: number;
  content: PrdSectionContent;
  reasoning: string;
  approvalId?: string;
  approvedByUserId?: string;
  approvedAt?: Date;
  rejectionFeedback?: string;
  qualitySignals?: PrdSectionQualitySignals;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrdSectionQualitySignals {
  generationAttempts: number;
  approvedOnFirstPass: boolean;
  revisionCount: number;
  approvalTimeMs?: number;
}

// ── Consistency & traceability ───────────────────────────────────────────────

export const ConsistencyIssueSchema = z.object({
  id: z.string(),
  severity: z.enum(['error', 'warning']),
  sections: z.array(z.string()),
  description: z.string(),
  suggestedResolution: z.string(),
});
export type ConsistencyIssue = z.infer<typeof ConsistencyIssueSchema>;

export interface ConsistencyReport {
  prdId: string;
  issues: ConsistencyIssue[];
  checkedAt: Date;
}

export interface TraceabilityGap {
  intentField: string;
  intentItemId: string;
  description: string;
}

export interface TraceabilityReport {
  prdId: string;
  coveredGoals: number;
  totalGoals: number;
  gaps: TraceabilityGap[];
  checkedAt: Date;
}

// ── Staleness ────────────────────────────────────────────────────────────────

export interface StalenessIndicator {
  sectionType: PrdSectionType;
  reason: string;
  changedIntentFields: string[];
}

export interface StalenessReport {
  prdId: string;
  isStale: boolean;
  indicators: StalenessIndicator[];
  detectedAt: Date;
}

// ── PRD composite ────────────────────────────────────────────────────────────

export interface Prd {
  intentBriefId: string;
  templateUsed?: string;
  sections: Record<PrdSectionType, PrdSection | null>;
  consistencyReport?: ConsistencyReport;
  traceabilityReport?: TraceabilityReport;
  stalenessIndicators?: StalenessIndicator[];
  isFullyApproved: boolean;
  totalGenerationCostUsd: number;
}

// ── Template ─────────────────────────────────────────────────────────────────

export interface PrdTemplate {
  id: string;
  workspaceId: string | null;
  name: string;
  description: string;
  category: string;
  sectionStarters: Partial<Record<PrdSectionType, string>>;
  builtIn: boolean;
  createdByUserId: string | null;
}

// ── Section dependency graph ─────────────────────────────────────────────────

export const SECTION_DEPENDENCIES: Record<PrdSectionType, PrdSectionType[]> = {
  purpose: [],
  scope: [],
  locked_decisions: ['purpose'],
  architectural_overview: ['locked_decisions', 'component_specifications'],
  hard_parts: ['locked_decisions'],
  component_specifications: ['locked_decisions', 'scope'],
  implementation_order: ['component_specifications', 'hard_parts'],
  adrs_to_write: ['locked_decisions', 'hard_parts'],
  verification_steps: ['component_specifications'],
  definition_of_done: ['component_specifications', 'verification_steps'],
  anti_patterns: ['locked_decisions', 'scope'],
  open_questions: ['component_specifications', 'hard_parts'],
  what_comes_next: ['definition_of_done'],
};

// ── Input / output types for service methods ─────────────────────────────────

export interface GeneratePrdOptions {
  templateId?: string;
}

export interface SectionEdit {
  content: Partial<PrdSectionContent>;
}

export interface GeneratePrdInput {
  intentBriefId: string;
  options?: GeneratePrdOptions;
}
