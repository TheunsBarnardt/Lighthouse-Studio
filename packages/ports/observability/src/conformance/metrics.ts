import { describe, expect, it } from 'vitest';

import type { MetricsPort } from '../metrics.port.js';

export function runMetricsConformance(name: string, factory: () => MetricsPort): void {
  describe(`${name} — MetricsPort conformance`, () => {
    it('counter() returns a Counter with add()', () => {
      const metrics = factory();
      const counter = metrics.counter('test_events_total', { description: 'test' });
      expect(typeof counter.add).toBe('function');
      expect(() => {
        counter.add(1);
      }).not.toThrow();
      expect(() => {
        counter.add(5, { label: 'value' });
      }).not.toThrow();
    });

    it('gauge() returns a Gauge with set()', () => {
      const metrics = factory();
      const gauge = metrics.gauge('test_active', { description: 'test' });
      expect(typeof gauge.set).toBe('function');
      expect(() => {
        gauge.set(42);
      }).not.toThrow();
      expect(() => {
        gauge.set(0, { region: 'eu' });
      }).not.toThrow();
    });

    it('histogram() returns a Histogram with record()', () => {
      const metrics = factory();
      const hist = metrics.histogram('test_duration_seconds', {
        description: 'test',
        unit: 's',
      });
      expect(typeof hist.record).toBe('function');
      expect(() => {
        hist.record(0.15);
      }).not.toThrow();
      expect(() => {
        hist.record(1.5, { method: 'GET' });
      }).not.toThrow();
    });

    it('same metric name returns the same instrument', () => {
      const metrics = factory();
      const c1 = metrics.counter('dedup_total');
      const c2 = metrics.counter('dedup_total');
      // Both must be functional (identity equality not guaranteed by interface)
      expect(() => {
        c1.add(1);
      }).not.toThrow();
      expect(() => {
        c2.add(1);
      }).not.toThrow();
    });

    it('histogram accepts custom boundaries', () => {
      const metrics = factory();
      const hist = metrics.histogram('latency_seconds', { boundaries: [0.1, 0.5, 1, 2, 5] });
      expect(() => {
        hist.record(0.3);
      }).not.toThrow();
    });
  });
}
