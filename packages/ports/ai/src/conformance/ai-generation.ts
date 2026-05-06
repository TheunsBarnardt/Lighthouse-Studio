import { describe, expect, it } from 'vitest';

import type { AIProviderPort } from '../ai-provider.port.js';

export function runAiProviderConformance(
  name: string,
  factory: () => Promise<AIProviderPort>,
): void {
  describe(`${name} — AIProviderPort conformance`, () => {
    it('has a stable string id', async () => {
      const provider = await factory();
      expect(typeof provider.id).toBe('string');
      expect(provider.id.length).toBeGreaterThan(0);
    });

    it('has capabilities object with required fields', async () => {
      const provider = await factory();
      expect(typeof provider.capabilities.streaming).toBe('boolean');
      expect(typeof provider.capabilities.toolUse).toBe('boolean');
      expect(typeof provider.capabilities.structuredOutput).toBe('boolean');
      expect(typeof provider.capabilities.imageInput).toBe('boolean');
      expect(typeof provider.capabilities.maxContextTokens).toBe('number');
      expect(provider.capabilities.maxContextTokens).toBeGreaterThan(0);
    });

    it('listModels returns at least one model', async () => {
      const provider = await factory();
      const result = await provider.listModels();
      expect(result.isOk()).toBe(true);
      const models = result._unsafeUnwrap();
      expect(models.length).toBeGreaterThan(0);
      const firstModel = models[0];
      expect(typeof firstModel?.id).toBe('string');
      expect(typeof firstModel?.contextWindow).toBe('number');
    });

    it('generate returns non-empty content with token usage', async () => {
      const provider = await factory();
      const models = (await provider.listModels())._unsafeUnwrap();
      const firstModelId = models[0]?.id ?? '';
      const result = await provider.generate({
        model: firstModelId,
        messages: [{ role: 'user', content: 'Reply with the single word: pong' }],
        metadata: { correlationId: 'conformance-test' },
      });
      expect(result.isOk()).toBe(true);
      const resp = result._unsafeUnwrap();
      expect(resp.content.length).toBeGreaterThan(0);
      expect(resp.usage.inputTokens).toBeGreaterThan(0);
      expect(resp.usage.outputTokens).toBeGreaterThan(0);
      expect(resp.usage.totalTokens).toBe(resp.usage.inputTokens + resp.usage.outputTokens);
      expect(resp.model).toBe(firstModelId);
    });

    it('countTokens returns a positive number', async () => {
      const provider = await factory();
      const models = (await provider.listModels())._unsafeUnwrap();
      const result = await provider.countTokens('Count my tokens.', models[0]?.id ?? '');
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBeGreaterThan(0);
    });

    it('healthCheck returns a health status object', async () => {
      const provider = await factory();
      const result = await provider.healthCheck();
      expect(result.isOk()).toBe(true);
      const status = result._unsafeUnwrap();
      expect(typeof status.healthy).toBe('boolean');
    });

    it('generateStream yields text_delta events followed by done', async () => {
      const provider = await factory();
      const models = (await provider.listModels())._unsafeUnwrap();
      const events = [];
      for await (const event of provider.generateStream({
        model: models[0]?.id ?? '',
        messages: [{ role: 'user', content: 'Say hello' }],
        metadata: { correlationId: 'conformance-stream-test' },
      })) {
        events.push(event);
        if (event.type === 'done' || event.type === 'error') break;
      }
      const doneEvent = events.find((e) => e.type === 'done');
      expect(doneEvent).toBeDefined();
    });
  });
}

/** Backward-compatible alias used by EchoAiAdapter tests. */
export { runAiProviderConformance as runAiGenerationConformance };
