import { z } from 'zod';
import { definePrompt } from '../../define-prompt.js';

const InputSchema = z.object({
  appName: z.string(),
  sdkNamespace: z.string(),
  designTokens: z.object({ primaryColor: z.string(), fontFamily: z.string(), fontScale: z.record(z.string()) }),
  hasRealtime: z.boolean(),
  hasFileUpload: z.boolean(),
});

const OutputSchema = z.object({
  packageJson: z.record(z.unknown()),
  tsConfig: z.record(z.unknown()),
  viteConfig: z.string(),
  tailwindConfig: z.string(),
  eslintConfig: z.record(z.unknown()),
  prettierConfig: z.record(z.unknown()),
  reasoning: z.string(),
});

export const buildConfigPrompt = definePrompt({
  id: 'ui-generation.build-config',
  version: '1.0.0',
  description: 'Generate project build configuration: package.json, tsconfig, vite, tailwind, eslint, prettier',
  inputs: InputSchema,
  outputs: OutputSchema,
  modelConfig: { provider: 'anthropic',
 model: 'claude-haiku-4-5-20251001', maxTokens: 3000, temperature: 0.1 },
  systemPrompt: `You generate build configuration for a Vite + React + TypeScript + Tailwind project.

package.json: include react, react-dom, react-router-dom, @tanstack/react-query, react-hook-form, zod, tailwindcss, vite, typescript, eslint, prettier.
Add tus-js-client if hasFileUpload.
Add the platform SDK package.

tsconfig.json: strict mode, path aliases for @/, module ESNext.
vite.config.ts: path alias @/ → ./src, tailwind plugin.
tailwind.config.ts: wire in design tokens as CSS custom properties or extend theme.
eslint: TypeScript + React + accessibility (eslint-plugin-jsx-a11y).
prettier: standard config.`,
  userPromptTemplate: `App: {{appName}}
SDK namespace: {{sdkNamespace}}
Realtime: {{hasRealtime}}
File upload: {{hasFileUpload}}

Design tokens to wire into Tailwind:
Primary color: {{designTokens.primaryColor}}
Font family: {{designTokens.fontFamily}}
Font scale (sample): {{JSON.stringify designTokens.fontScale}}

Generate all config files.`,
  tests: [
    {
      description: 'Generates package.json with required dependencies',
      input: {
        appName: 'CRM',
        sdkNamespace: 'crm',
        hasRealtime: true,
        hasFileUpload: true,
        designTokens: { primaryColor: '#3B82F6', fontFamily: 'Inter', fontScale: { sm: '0.875rem', base: '1rem' } },
      },
      assertions: [
        { path: 'packageJson.dependencies', contains: 'react' },
      ],
    },
  ],
});
