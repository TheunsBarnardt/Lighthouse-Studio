import { describe, expect, it } from 'vitest';

import { listPrimitiveRefs, resolveRef, resolveToken } from './alias-graph';
import { buildDefaultTheme } from './preset-themes';

const theme = buildDefaultTheme();

describe('resolveRef', () => {
  it('resolves a primitive color step', () => {
    const v = resolveRef('primitives.colors.primary.500', theme.primitives);
    expect(v).toBeTruthy();
    expect(v).toMatch(/^\d/);
  });

  it('resolves base when step omitted', () => {
    const v = resolveRef('primitives.colors.primary', theme.primitives);
    expect(v).toBeTruthy();
  });

  it('returns null for unknown groups', () => {
    expect(resolveRef('primitives.colors.unicorn.500', theme.primitives)).toBeNull();
  });
});

describe('resolveToken', () => {
  it('returns literal value', () => {
    expect(resolveToken({ value: '0 0% 50%' }, theme.primitives)).toBe('0 0% 50%');
  });

  it('resolves an alias', () => {
    expect(resolveToken({ ref: 'primitives.colors.primary.500' }, theme.primitives)).toBeTruthy();
  });

  it('throws on unknown alias', () => {
    expect(() => resolveToken({ ref: 'primitives.colors.fake.500' }, theme.primitives)).toThrow();
  });
});

describe('listPrimitiveRefs', () => {
  it('contains color base + step references', () => {
    const refs = listPrimitiveRefs(theme.primitives);
    expect(refs).toContain('primitives.colors.primary');
    expect(refs).toContain('primitives.colors.primary.500');
    expect(refs).toContain('primitives.spacing.4');
  });
});
