/**
 * Intent Capture types — Objective 21
 *
 * The IntentBrief is the approved artifact from Stage 1 that Stage 2 (PRD
 * generation) consumes as its primary input. These types are the contract
 * between Objective 21 and Objective 22.
 */

import { z } from 'zod';

// ── Sub-types ──────────────────────────────────────────────────────────────────

export interface IntentGoal {
  id: string; // e.g., 'goal-1'
  description: string;
  priority: 'must' | 'should' | 'nice-to-have';
}

export interface IntentPersona {
  id: string; // e.g., 'persona-1'
  name: string;
  description: string;
  needs: string[];
  painPoints?: string[];
}

export interface IntentConstraint {
  id: string;
  description: string;
  type: 'technical' | 'business' | 'regulatory' | 'resource';
}

// ── Intent Brief ──────────────────────────────────────────────────────────────

export interface IntentBrief {
  /** Workspace that owns this intent brief. */
  workspaceId: string;
  /** Pipeline run this intent brief initiated. */
  pipelineId: string;
  /** Concise title of the project or feature. */
  title: string;
  /** 1-3 paragraph description of what is to be built and why. */
  description: string;
  /** Project type hint (informs PRD templates). */
  projectType:
    | 'crm'
    | 'blog'
    | 'dashboard'
    | 'internal_tool'
    | 'customer_portal'
    | 'e_commerce'
    | 'other';
  goals: IntentGoal[];
  targetUsers: IntentPersona[];
  inScope: string[];
  outOfScope: string[];
  constraints: IntentConstraint[];
  assumptions: string[];
  /** ISO timestamp when the user approved the intent brief. */
  approvedAt: string;
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

export const IntentGoalSchema = z.object({
  id: z.string(),
  description: z.string().min(1),
  priority: z.enum(['must', 'should', 'nice-to-have']),
});

export const IntentPersonaSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string(),
  needs: z.array(z.string()),
  painPoints: z.array(z.string()).optional(),
});

export const IntentConstraintSchema = z.object({
  id: z.string(),
  description: z.string().min(1),
  type: z.enum(['technical', 'business', 'regulatory', 'resource']),
});

export const IntentBriefSchema = z.object({
  workspaceId: z.string().uuid(),
  pipelineId: z.string(),
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  projectType: z.enum([
    'crm',
    'blog',
    'dashboard',
    'internal_tool',
    'customer_portal',
    'e_commerce',
    'other',
  ]),
  goals: z.array(IntentGoalSchema).min(1),
  targetUsers: z.array(IntentPersonaSchema).min(1),
  inScope: z.array(z.string()),
  outOfScope: z.array(z.string()),
  constraints: z.array(IntentConstraintSchema),
  assumptions: z.array(z.string()),
  approvedAt: z.string().datetime(),
});

export type IntentBriefInput = z.infer<typeof IntentBriefSchema>;
