import { describe, expect, it } from 'vitest';

import type { AiGenerationPort } from '../ai-generation.port.js';

export function runAiGenerationConformance(
  name: string,
  factory: () => Promise<AiGenerationPort>,
): void {
  describe(`${name} — AiGenerationPort conformance`, () => {
    it('generate returns a non-empty content string', async () => {
      const ai = await factory();
      const result = await ai.generate([{ role: 'user', content: 'Say "pong" and nothing else.' }]);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().content.length).toBeGreaterThan(0);
    });

    it('generate result includes token usage', async () => {
      const ai = await factory();
      const result = await ai.generate([{ role: 'user', content: 'Hello.' }]);
      const usage = result._unsafeUnwrap().usage;
      expect(usage.inputTokens).toBeGreaterThan(0);
      expect(usage.outputTokens).toBeGreaterThan(0);
      expect(usage.totalTokens).toBe(usage.inputTokens + usage.outputTokens);
    });

    it('countTokens returns a positive number', async () => {
      const ai = await factory();
      const result = await ai.countTokens([{ role: 'user', content: 'Count my tokens.' }]);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBeGreaterThan(0);
    });

    it('availableModels returns at least one model', async () => {
      const ai = await factory();
      expect(ai.availableModels().length).toBeGreaterThan(0);
    });
  });
}
