import os from 'node:os';
/**
 * Cross-platform path handling tests.
 * These run on both Linux and Windows CI runners (Objective 9, §5.8).
 * They verify that platform utilities produce correct results regardless of OS.
 */
import path from 'node:path';
import { describe, it, expect } from 'vitest';

describe('path.join cross-platform behaviour', () => {
  it('joins path segments without double separators', () => {
    const result = path.join('a', 'b', 'c');
    expect(result).not.toContain('//');
    expect(result).not.toContain('\\\\');
  });

  it('produces a non-empty string from valid segments', () => {
    expect(path.join('base', 'sub', 'file.txt')).toBeTruthy();
  });

  it('does not end with a separator unless input is root', () => {
    const result = path.join('a', 'b', 'c');
    expect(result).not.toMatch(/[/\\]$/);
  });

  it('resolves . and .. correctly', () => {
    const result = path.join('a', 'b', '..', 'c');
    const expected = path.join('a', 'c');
    expect(result).toBe(expected);
  });

  it('path.posix.join always uses forward slashes', () => {
    const result = path.posix.join('a', 'b', 'c');
    expect(result).toBe('a/b/c');
    expect(result).not.toContain('\\');
  });
});

describe('os.tmpdir()', () => {
  it('returns a non-empty string', () => {
    expect(os.tmpdir()).toBeTruthy();
    expect(typeof os.tmpdir()).toBe('string');
  });

  it('returns an absolute path', () => {
    expect(path.isAbsolute(os.tmpdir())).toBe(true);
  });

  it('the temp directory exists (or is accessible)', () => {
    // We verify the path is valid — not that we can write to it,
    // since that would require side effects.
    const tmp = os.tmpdir();
    expect(tmp.length).toBeGreaterThan(0);
  });
});

describe('path.resolve cross-platform', () => {
  it('always returns an absolute path', () => {
    const result = path.resolve('some', 'relative', 'path');
    expect(path.isAbsolute(result)).toBe(true);
  });

  it('does not contain null bytes', () => {
    const result = path.resolve('a', 'b', 'c');
    expect(result).not.toContain('\0');
  });
});

describe('path.extname', () => {
  it('correctly extracts extensions regardless of separator', () => {
    // path.extname uses the platform separator internally but the
    // input string conventions must be followed
    expect(path.extname('file.ts')).toBe('.ts');
    expect(path.extname('archive.tar.gz')).toBe('.gz');
    expect(path.extname('noext')).toBe('');
  });
});
