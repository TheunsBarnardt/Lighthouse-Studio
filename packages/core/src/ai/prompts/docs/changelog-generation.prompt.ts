import { z } from 'zod';
import { definePrompt } from '../define-prompt.js';

const inputs = z.object({
  deploymentVersion: z.string(),
  deploymentEvents: z.array(z.object({
    type: z.string(),
    description: z.string(),
    environment: z.string(),
    timestamp: z.string(),
  })),
  previousVersion: z.string().optional(),
  artifactChanges: z.array(z.object({
    artifact: z.string(),
    changeType: z.enum(['created', 'updated', 'deleted']),
    summary: z.string(),
  })).optional(),
});

const outputs = z.object({
  title: z.string().describe('Changelog entry title, e.g. "v0.3.0 — 2026-05-07"'),
  summary: z.string().describe('One-paragraph summary of what changed in this version'),
  sections: z.array(z.object({
    heading: z.string().describe('E.g. "New Features", "Bug Fixes", "Breaking Changes"'),
    items: z.array(z.string()).describe('Bullet items for this section'),
  })),
  breakingChanges: z.boolean(),
  reasoning: z.object({
    categorizationRationale: z.string(),
  }),
});

export const changelogGenerationPrompt = definePrompt({
  id: 'docs.changelog-generation',
  version: '1.0.0',
  description: 'Generate a human-readable changelog entry from deployment events and artifact changes',
  inputs,
  outputs,
  modelConfig: {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1500,
    temperature: 0.2,
  },
  systemPrompt: `You are a technical writer generating changelog entries. Conventions:
- Use Keep a Changelog format: Added, Changed, Fixed, Removed, Security, Breaking Changes
- Write from the developer's perspective: what can they now do, or what changed for them
- Omit internal infrastructure changes that aren't visible to app developers
- Breaking changes must be highlighted in both a dedicated section and the summary
- Version titles follow semantic versioning with date: "v1.2.3 — YYYY-MM-DD"`,

  userPromptTemplate: `Generate a changelog entry for deployment version {{deploymentVersion}}.

{{#if previousVersion}}Previous version: {{previousVersion}}{{/if}}

Deployment events:
{{deploymentEvents}}

{{#if artifactChanges}}
Artifact changes:
{{artifactChanges}}
{{/if}}

Categorize changes into appropriate sections and flag any breaking changes.`,

  tests: [
    {
      description: 'generates changelog with correct sections',
      input: {
        deploymentVersion: 'v0.2.0',
        deploymentEvents: [{ type: 'deploy', description: 'Deployed to production', environment: 'prod', timestamp: '2026-05-07T10:00:00Z' }],
        artifactChanges: [{ artifact: 'ContactsTable', changeType: 'updated', summary: 'Fixed null error on missing owner' }],
      },
      assertions: [
        { type: 'output_present', path: 'title' },
        { type: 'output_present', path: 'sections' },
        { type: 'output_contains', path: 'title', value: 'v0.2.0' },
      ],
    },
  ],
});
