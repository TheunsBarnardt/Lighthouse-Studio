import { z } from 'zod';
import { definePrompt, registerPrompt } from '../registry.js';

const inputs = z.object({ projectType: z.string(), vibeDescriptors: z.array(z.string()) });

const outputs = z.object({
  iconXs: z.string(), iconSm: z.string(), iconMd: z.string(), iconLg: z.string(), iconXl: z.string(),
  avatarSm: z.string(), avatarMd: z.string(), avatarLg: z.string(),
  containerSm: z.string(), containerMd: z.string(), containerLg: z.string(), containerXl: z.string(),
  reasoning: z.string(),
});

export const sizingPrompt = definePrompt({
  id: 'design-tokens.sizing',
  version: '1.0.0',
  description: 'Generate sizing tokens for icons, avatars, and containers',
  inputs,
  outputs,
  modelConfig: { model: 'claude-haiku-4-5-20251001', maxTokens: 1024, temperature: 0.1 },
  systemPrompt: `Generate sizing tokens. Icons in rem (xs=0.75rem, sm=1rem, md=1.25rem, lg=1.5rem, xl=2rem). Avatars (sm=1.5rem, md=2rem, lg=3rem). Containers (sm=640px, md=768px, lg=1024px, xl=1280px). Adjust slightly for vibe.`,
  userPromptTemplate: `Project: {{projectType}}, Vibe: {{vibeDescriptors}}. Generate sizing tokens.`,
  tests: [
    {
      name: 'generates sizing tokens',
      input: { projectType: 'CRM', vibeDescriptors: ['professional'] },
      assertions: [(output: z.infer<typeof outputs>) => output.iconMd.endsWith('rem')],
    },
  ],
});

registerPrompt(sizingPrompt);
