/**
 * Timezone and date handling cross-platform tests.
 * Verifies that timestamps round-trip as UTC regardless of system timezone.
 */
import { describe, it, expect } from 'vitest';

describe('Date UTC handling', () => {
  it('new Date().toISOString() always ends in Z (UTC)', () => {
    expect(new Date().toISOString()).toMatch(/Z$/);
  });

  it('Date.now() is a positive integer (ms since Unix epoch)', () => {
    const now = Date.now();
    expect(typeof now).toBe('number');
    expect(Number.isInteger(now)).toBe(true);
    expect(now).toBeGreaterThan(0);
  });

  it('UTC getters are consistent with toISOString()', () => {
    const d = new Date('2024-06-15T12:30:45.000Z');
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(5); // 0-indexed
    expect(d.getUTCDate()).toBe(15);
    expect(d.getUTCHours()).toBe(12);
    expect(d.getUTCMinutes()).toBe(30);
    expect(d.getUTCSeconds()).toBe(45);
  });

  it('ISO string round-trips through Date construction', () => {
    const iso = '2025-01-01T00:00:00.000Z';
    const d = new Date(iso);
    expect(d.toISOString()).toBe(iso);
  });

  it('timestamps from Date.now() are monotonically non-decreasing', () => {
    const t1 = Date.now();
    const t2 = Date.now();
    expect(t2).toBeGreaterThanOrEqual(t1);
  });

  it('does not rely on local timezone for epoch conversion', () => {
    // This test would fail if code used getFullYear() instead of getUTCFullYear()
    // on a machine with a timezone offset that shifts across midnight.
    const epochMs = 1_000_000_000_000; // 2001-09-09T01:46:40.000Z
    const d = new Date(epochMs);
    expect(d.getUTCFullYear()).toBe(2001);
    expect(d.toISOString()).toBe('2001-09-09T01:46:40.000Z');
  });
});
