import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

export const dependencyAdvisoryImpactPrompt = definePrompt({
  id: 'maintenance/dependency-advisory-impact',
  version: '1.0.0',
  description: 'Assess whether a dependency advisory affects a specific customer app',
  inputs: z.object({
    advisory: z.object({
      packageName: z.string(),
      affectedVersions: z.string(),
      severity: z.string(),
      description: z.string(),
      cveId: z.string().optional(),
    }),
    appDependencies: z.record(z.string()),
    appDescription: z.string(),
  }),
  outputs: z.object({
    affected: z.boolean(),
    installedVersion: z.string().optional(),
    exploitable: z.boolean(),
    exploitabilityReasoning: z.string(),
    recommendedAction: z.enum(['upgrade_now', 'upgrade_soon', 'monitor', 'not_applicable']),
    urgency: z.enum(['immediate', 'this_sprint', 'next_sprint', 'backlog']),
  }),
  modelConfig: { model: 'claude-haiku-4-5', maxTokens: 800, temperature: 0.1 },
  systemPrompt: `Assess whether a dependency advisory affects a specific customer application.
Determine if the app's installed version falls within the advisory's affected range.
If affected, assess exploitability in the context of how the app uses the package.
Recommend appropriate urgency: don't over-alarm for low-impact advisories.
Output ONLY valid JSON.`,
  userPromptTemplate: `Advisory:
Package: {{advisory.packageName}}
Affected versions: {{advisory.affectedVersions}}
Severity: {{advisory.severity}}
Description: {{advisory.description}}
CVE: {{advisory.cveId}}

App dependencies: {{appDependencies}}
App description: {{appDescription}}

Is this app affected? Is it exploitable? What action should be taken?`,
  tests: [],
});
