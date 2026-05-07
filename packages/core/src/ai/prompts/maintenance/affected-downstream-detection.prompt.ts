import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

export const affectedDownstreamDetectionPrompt = definePrompt({
  id: 'maintenance/affected-downstream-detection',
  version: '1.0.0',
  description: 'Identify downstream artifacts affected by a change to a given artifact',
  inputs: z.object({
    artifactId: z.string(),
    artifactType: z.string(),
    changeDescription: z.string(),
    dependentArtifacts: z.array(z.object({
      id: z.string(),
      type: z.string(),
      description: z.string(),
    })),
  }),
  outputs: z.object({
    affectedArtifacts: z.array(z.object({
      artifactId: z.string(),
      cascadeStatus: z.enum(['stale', 'affected', 'unaffected']),
      reasoning: z.string(),
    })),
    totalAffected: z.number(),
    totalStale: z.number(),
  }),
  modelConfig: { model: 'claude-haiku-4-5', maxTokens: 1500, temperature: 0.1 },
  systemPrompt: `Identify which downstream artifacts are affected by a change to an upstream artifact.

Status definitions:
- "affected": the change REQUIRES this artifact to be regenerated (breaking dependency)
- "stale": the change MIGHT require regeneration (check recommended)
- "unaffected": the change does not impact this artifact

Err on the side of "stale" for ambiguous cases. Better to over-flag than to silently drift.
Output ONLY valid JSON.`,
  userPromptTemplate: `Changed artifact: {{artifactId}} ({{artifactType}})
Change: {{changeDescription}}

Dependent artifacts:
{{dependentArtifacts}}

Classify each dependent as affected, stale, or unaffected.`,
  tests: [],
});
