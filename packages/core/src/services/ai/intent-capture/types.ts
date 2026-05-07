import { z } from 'zod';

// ── Sub-schemas ───────────────────────────────────────────────────────────────

export const GoalSchema = z.object({
  id: z.string(),
  description: z.string().min(1),
  priority: z.enum(['must_have', 'should_have', 'nice_to_have']),
  acceptanceCriteria: z.array(z.string()).default([]),
});
export type Goal = z.infer<typeof GoalSchema>;

export const TargetUserSchema = z.object({
  id: z.string(),
  persona: z.string().min(1),
  description: z.string(),
  needs: z.array(z.string()).default([]),
  painPoints: z.array(z.string()).default([]),
});
export type TargetUser = z.infer<typeof TargetUserSchema>;

export const SuccessCriterionSchema = z.object({
  id: z.string(),
  description: z.string().min(1),
  metric: z.string().optional(),
  target: z.string().optional(),
});
export type SuccessCriterion = z.infer<typeof SuccessCriterionSchema>;

export const ConstraintSchema = z.object({
  id: z.string(),
  type: z.enum(['technical', 'business', 'regulatory', 'timeline', 'budget']),
  description: z.string().min(1),
  severity: z.enum(['hard', 'soft']),
});
export type Constraint = z.infer<typeof ConstraintSchema>;

export const AssumptionSchema = z.object({
  id: z.string(),
  description: z.string().min(1),
  impact: z.enum(['high', 'medium', 'low']),
  confidence: z.number().min(0).max(1),
});
export type Assumption = z.infer<typeof AssumptionSchema>;

export const RiskSchema = z.object({
  id: z.string(),
  description: z.string().min(1),
  likelihood: z.enum(['high', 'medium', 'low']),
  impact: z.enum(['high', 'medium', 'low']),
  mitigationIdea: z.string().optional(),
});
export type Risk = z.infer<typeof RiskSchema>;

export const ReferenceSchema = z.object({
  id: z.string(),
  type: z.enum(['url', 'document', 'system', 'competitor']),
  title: z.string(),
  value: z.string(),
  notes: z.string().optional(),
});
export type Reference = z.infer<typeof ReferenceSchema>;

// ── IntentBrief ───────────────────────────────────────────────────────────────

export const IntentBriefSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().min(10),
  goals: z.array(GoalSchema).min(1),
  targetUsers: z.array(TargetUserSchema).min(1),
  successCriteria: z.array(SuccessCriterionSchema).default([]),
  inScope: z.array(z.string()).default([]),
  outOfScope: z.array(z.string()).default([]),
  estimatedScope: z.enum(['small', 'medium', 'large', 'xl']).optional(),
  constraints: z.array(ConstraintSchema).default([]),
  assumptions: z.array(AssumptionSchema).default([]),
  risks: z.array(RiskSchema).default([]),
  references: z.array(ReferenceSchema).default([]),
  templateId: z.string().optional(),
});
export type IntentBrief = z.infer<typeof IntentBriefSchema>;

// ── BriefDraft ────────────────────────────────────────────────────────────────

export type BriefFieldStatus = 'empty' | 'tentative' | 'confident';

export interface BriefFieldState {
  status: BriefFieldStatus;
  sourceExcerpts: string[];
  lastUpdatedTurn: number;
}

export interface BriefDraft {
  title?: string;
  summary?: string;
  goals: Goal[];
  targetUsers: TargetUser[];
  successCriteria: SuccessCriterion[];
  inScope: string[];
  outOfScope: string[];
  estimatedScope?: 'small' | 'medium' | 'large' | 'xl';
  constraints: Constraint[];
  assumptions: Assumption[];
  risks: Risk[];
  references: Reference[];
  fieldStates: Record<string, BriefFieldState>;
  completenessPercent: number;
  readyToGenerate: boolean;
}

// ── Conversation ──────────────────────────────────────────────────────────────

export type ConversationStatus = 'active' | 'brief_generated' | 'expired';

export const ConversationMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  reasoning: z.string().optional(),
  turnNumber: z.number().int().min(1),
  costUsd: z.number().optional(),
  createdAt: z.date(),
  briefUpdates: z.record(z.unknown()).optional(),
  toolCallsUsed: z.array(z.string()).default([]),
});
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

export const ConversationSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  status: z.enum(['active', 'brief_generated', 'expired']),
  templateId: z.string().optional(),
  messages: z.array(ConversationMessageSchema),
  briefDraft: z.custom<BriefDraft>().optional(),
  turnCount: z.number().int().min(0),
  totalCostUsd: z.number(),
  lastActiveAt: z.date(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

// ── IntentBriefTemplate ───────────────────────────────────────────────────────

export interface IntentBriefTemplate {
  id: string;
  workspaceId: string | null;
  name: string;
  description: string;
  category: string;
  starterMessage: string;
  suggestedFocusAreas: string[];
  builtIn: boolean;
  createdByUserId: string | null;
  _version: number;
  _archivedAt: Date | null;
  _createdAt: Date;
  _updatedAt: Date;
}

// ── ConversationEvent (SSE discriminated union) ───────────────────────────────

export type ConversationEvent =
  | { type: 'text_delta'; delta: string; turnNumber: number }
  | { type: 'reasoning_delta'; delta: string }
  | { type: 'tool_call_start'; toolName: string; description: string }
  | { type: 'tool_call_complete'; toolName: string; result: string }
  | { type: 'brief_update'; fieldName: string; status: BriefFieldStatus; preview: string }
  | { type: 'ready_to_generate'; readyToGenerate: boolean }
  | { type: 'cost_update'; costUsd: number; totalCostUsd: number }
  | { type: 'turn_complete'; message: ConversationMessage; briefDraft: BriefDraft }
  | { type: 'error'; code: string; message: string }
  | { type: 'turn_limit_reached'; limit: number };

// ── BriefEdit ─────────────────────────────────────────────────────────────────

export interface BriefEdit {
  title?: string;
  summary?: string;
  goals?: Goal[];
  targetUsers?: TargetUser[];
  successCriteria?: SuccessCriterion[];
  inScope?: string[];
  outOfScope?: string[];
  estimatedScope?: 'small' | 'medium' | 'large' | 'xl';
  constraints?: Constraint[];
  assumptions?: Assumption[];
  risks?: Risk[];
  references?: Reference[];
}
