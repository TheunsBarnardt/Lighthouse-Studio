import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ThemeValidationError,
  ThemeVersionConflictError,
  _clearInMemoryCacheForTests,
  getWorkspaceTheme,
  updateWorkspaceTheme,
} from './workspace-theme-service';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'lh-theme-'));
  process.env.LIGHTHOUSE_DATA_DIR = tmp;
  _clearInMemoryCacheForTests();
});

afterEach(() => {
  delete process.env.LIGHTHOUSE_DATA_DIR;
  try {
    rmSync(tmp, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe('workspace-theme-service', () => {
  it('returns a default theme for new workspaces', () => {
    const t = getWorkspaceTheme('acme');
    expect(t.version).toBe(1);
    expect(t.source).toBe('preset');
    expect(t.primitives.colors.primary).toBeTruthy();
  });

  it('round-trips an update and bumps the version', () => {
    const initial = getWorkspaceTheme('acme');
    const next = updateWorkspaceTheme({
      workspaceId: 'acme',
      expectedVersion: initial.version,
      next: { ...initial, source: 'custom' },
      user: 'user-1',
    });
    expect(next.version).toBe(initial.version + 1);
    expect(next.updatedBy).toBe('user-1');
  });

  it('throws on version mismatch', () => {
    const initial = getWorkspaceTheme('acme');
    expect(() =>
      updateWorkspaceTheme({
        workspaceId: 'acme',
        expectedVersion: initial.version + 5,
        next: initial,
        user: 'user-1',
      }),
    ).toThrow(ThemeVersionConflictError);
  });

  it('throws on schema validation failure', () => {
    const initial = getWorkspaceTheme('acme');
    const bad = { ...initial, semantics: 'not an object' } as unknown as typeof initial;
    expect(() =>
      updateWorkspaceTheme({
        workspaceId: 'acme',
        expectedVersion: initial.version,
        next: bad,
        user: 'user-1',
      }),
    ).toThrow(ThemeValidationError);
  });

  it('persists to disk and reloads after cache clear', () => {
    const initial = getWorkspaceTheme('acme');
    const updated = updateWorkspaceTheme({
      workspaceId: 'acme',
      expectedVersion: initial.version,
      next: { ...initial, radiusBase: '0.75rem' },
      user: 'user-1',
    });
    _clearInMemoryCacheForTests();
    const reloaded = getWorkspaceTheme('acme');
    expect(reloaded.version).toBe(updated.version);
    expect(reloaded.radiusBase).toBe('0.75rem');
  });

  it('isolates workspaces from each other', () => {
    const a = getWorkspaceTheme('alpha');
    const b = getWorkspaceTheme('beta');
    updateWorkspaceTheme({
      workspaceId: 'alpha',
      expectedVersion: a.version,
      next: { ...a, radiusBase: '1rem' },
      user: 'u',
    });
    expect(getWorkspaceTheme('beta').radiusBase).toBe(b.radiusBase);
  });
});
