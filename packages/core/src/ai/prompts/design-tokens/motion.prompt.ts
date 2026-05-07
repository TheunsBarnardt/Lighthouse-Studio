import { z } from 'zod';
import { definePrompt, registerPrompt } from '../../define-prompt.js';

const inputs = z.object({ vibeDescriptors: z.array(z.string()) });

const outputs = z.object({
  durationFast: z.string(),
  durationBase: z.string(),
  durationSlow: z.string(),
  easingDefault: z.string(),
  easingIn: z.string(),
  easingOut: z.string(),
  easingBounce: z.string(),
  reasoning: z.string(),
});

export const motionPrompt = definePrompt({
  id: 'design-tokens.motion',
  version: '1.0.0',
  description: 'Generate motion/animation tokens',
  inputs,
  outputs,
  modelConfig: { provider: 'anthropic',
 model: 'claude-haiku-4-5-20251001', maxTokens: 512, temperature: 0.2 },
  systemPrompt: `Generate motion tokens: durations in ms (fast: 100-150ms, base: 200-250ms, slow: 400-500ms). Easings as CSS cubic-bezier or named keywords. Playful vibes use bounce; professional vibes use subtle ease-out.`,
  userPromptTemplate: `Vibe: {{vibeDescriptors}}. Generate motion tokens.`,
  tests: [
    {
      name: 'generates motion tokens',
      input: { vibeDescriptors: ['professional'] },
      assertions: [
        (output: z.infer<typeof outputs>) => output.durationFast.endsWith('ms'),
        (output: z.infer<typeof outputs>) => output.easingDefault.length > 0,
      ],
    },
  ],
});

registerPrompt(motionPrompt);
