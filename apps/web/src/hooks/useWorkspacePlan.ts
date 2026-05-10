'use client';

export type WorkspacePlan = 'free' | 'pro' | 'enterprise';

export type PlanFeature =
  | 'customFonts'
  | 'googleFonts'
  | 'multipleThemes'
  | 'aiGeneration'
  | 'cvdSimulator'
  | 'exportTypescript';

const FEATURE_TIER: Record<PlanFeature, WorkspacePlan> = {
  customFonts: 'enterprise',
  googleFonts: 'pro',
  multipleThemes: 'pro',
  aiGeneration: 'pro',
  cvdSimulator: 'pro',
  exportTypescript: 'pro',
};

const TIER_RANK: Record<WorkspacePlan, number> = { free: 0, pro: 1, enterprise: 2 };

export function useWorkspacePlan(): {
  plan: WorkspacePlan;
  can: (feature: PlanFeature) => boolean;
  required: (feature: PlanFeature) => WorkspacePlan;
} {
  const plan: WorkspacePlan = 'pro';
  return {
    plan,
    can: (feature) => TIER_RANK[plan] >= TIER_RANK[FEATURE_TIER[feature]],
    required: (feature) => FEATURE_TIER[feature],
  };
}
