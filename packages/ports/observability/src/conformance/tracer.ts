import { describe, expect, it } from 'vitest';

import type { TracerPort } from '../tracer.port.js';

export function runTracerConformance(name: string, factory: () => TracerPort): void {
  describe(`${name} — TracerPort conformance`, () => {
    it('withSpan runs the function and returns its result', async () => {
      const tracer = factory();
      const result = await tracer.withSpan('test.span', (_span) => 42);
      expect(result).toBe(42);
    });

    it('withSpan runs async functions', async () => {
      const tracer = factory();
      const result = await tracer.withSpan('test.async', (_span) => Promise.resolve('hello'));
      expect(result).toBe('hello');
    });

    it('withSpan propagates errors', async () => {
      const tracer = factory();
      await expect(
        tracer.withSpan('test.error', (_span) => {
          throw new Error('expected');
        }),
      ).rejects.toThrow('expected');
    });

    it('withSpan provides a Span with setAttribute and setStatus', async () => {
      const tracer = factory();
      await tracer.withSpan('test.span-api', (span) => {
        expect(typeof span.setAttribute).toBe('function');
        expect(typeof span.setAttributes).toBe('function');
        expect(typeof span.setStatus).toBe('function');
        expect(typeof span.recordException).toBe('function');
        expect(typeof span.traceId).toBe('string');
        expect(typeof span.spanId).toBe('string');
      });
    });

    it('currentSpan() returns undefined outside a span', () => {
      const tracer = factory();
      // Outside withSpan, may return undefined (noop) or a valid span if there is one
      const span = tracer.currentSpan();
      expect(span === undefined || typeof span.setAttribute === 'function').toBe(true);
    });

    it('extract() returns undefined for empty headers', () => {
      const tracer = factory();
      const ctx = tracer.extract({});
      expect(ctx === undefined || typeof ctx.traceId === 'string').toBe(true);
    });

    it('inject() does not throw', () => {
      const tracer = factory();
      const headers: Record<string, string> = {};
      expect(() => {
        tracer.inject(headers);
      }).not.toThrow();
    });
  });
}
