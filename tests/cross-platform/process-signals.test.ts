/**
 * Process signal cross-platform tests.
 * Verifies that the signals the platform uses for graceful shutdown are handled
 * on both Linux and Windows (where SIGTERM and SIGINT are emulated by Node).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('process signal handling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('can register a SIGTERM handler without throwing', () => {
    const handler = vi.fn();
    expect(() => process.on('SIGTERM', handler)).not.toThrow();
    process.off('SIGTERM', handler);
  });

  it('can register a SIGINT handler without throwing', () => {
    const handler = vi.fn();
    expect(() => process.on('SIGINT', handler)).not.toThrow();
    process.off('SIGINT', handler);
  });

  it('process.listenerCount returns correct count after on/off', () => {
    const handler = vi.fn();
    const before = process.listenerCount('SIGTERM');
    process.on('SIGTERM', handler);
    expect(process.listenerCount('SIGTERM')).toBe(before + 1);
    process.off('SIGTERM', handler);
    expect(process.listenerCount('SIGTERM')).toBe(before);
  });
});

describe('process.platform', () => {
  it('is a non-empty string', () => {
    expect(typeof process.platform).toBe('string');
    expect(process.platform.length).toBeGreaterThan(0);
  });

  it('is one of the expected values', () => {
    const valid = ['linux', 'darwin', 'win32', 'freebsd', 'openbsd', 'android', 'sunos', 'aix'];
    expect(valid).toContain(process.platform);
  });
});

describe('process.env', () => {
  it('NODE_ENV is accessible', () => {
    // NODE_ENV may or may not be set, but access should not throw
    expect(() => process.env['NODE_ENV']).not.toThrow();
  });
});
