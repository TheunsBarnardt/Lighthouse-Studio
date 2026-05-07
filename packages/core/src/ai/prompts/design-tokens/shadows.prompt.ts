import { z } from 'zod';
import { definePrompt, registerPrompt } from '../registry.js';

const inputs = z.object({ projectType: z.string(), vibeDescriptors: z.array(z.string()) });

const outputs = z.object({
  none: z.string(), sm: z.string(), base: z.string(), md: z.string(),
  lg: z.string(), xl: z.string(), inner: z.string(),
  reasoning: z.string(),
});

export const shadowsPrompt = definePrompt({
  id: 'design-tokens.shadows',
  version: '1.0.0',
  description: 'Generate shadow/elevation tokens',
  inputs,
  outputs,
  modelConfig: { model: 'claude-haiku-4-5-20251001', maxTokens: 512, temperature: 0.2 },
  systemPrompt: `Generate 7 CSS box-shadow values: none, sm, base, md, lg, xl, inner. Progress from subtle to pronounced elevation. Use rgba() with black at low opacity. Flat/minimal vibes get very subtle shadows; bold vibes get more pronounced ones.`,
  userPromptTemplate: `Project: {{projectType}}, Vibe: {{vibeDescriptors}}. Generate shadow tokens.`,
  tests: [
    {
      name: 'generates shadow tokens',
      input: { projectType: 'CRM', vibeDescriptors: ['professional'] },
      assertions: [(output: z.infer<typeof outputs>) => output.none === 'none'],
    },
  ],
});

registerPrompt(shadowsPrompt);
