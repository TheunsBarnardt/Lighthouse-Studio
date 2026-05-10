import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { WorkspaceThemeSchema, type WorkspaceTheme } from '@/lib/theme/types';
import { buildDefaultTheme } from '@/lib/theme/preset-themes';

const _store = new Map<string, WorkspaceTheme>();

function dataDir(): string {
  const override = process.env.LIGHTHOUSE_DATA_DIR;
  const base = override ?? join(homedir(), '.lighthouse-studio', 'data');
  const dir = join(base, 'workspace-themes');
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      /* ignore — falls back to in-memory only */
    }
  }
  return dir;
}

function safeSlug(workspaceId: string): string {
  return workspaceId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function themePath(workspaceId: string): string {
  return join(dataDir(), `${safeSlug(workspaceId)}.json`);
}

function readFromDisk(workspaceId: string): WorkspaceTheme | null {
  try {
    const raw = readFileSync(themePath(workspaceId), 'utf8');
    const parsed = WorkspaceThemeSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeToDisk(workspaceId: string, theme: WorkspaceTheme): void {
  try {
    writeFileSync(themePath(workspaceId), JSON.stringify(theme, null, 2), 'utf8');
  } catch {
    /* in-memory store still serves the request */
  }
}

export class ThemeVersionConflictError extends Error {
  constructor(public readonly current: WorkspaceTheme) {
    super('Theme version conflict');
  }
}

export class ThemeValidationError extends Error {
  constructor(public readonly issues: unknown) {
    super('Theme validation failed');
  }
}

export function getWorkspaceTheme(workspaceId: string): WorkspaceTheme {
  let theme = _store.get(workspaceId);
  if (!theme) {
    theme = readFromDisk(workspaceId) ?? buildDefaultTheme('system');
    _store.set(workspaceId, theme);
  }
  return theme;
}

export interface UpdateThemeInput {
  workspaceId: string;
  expectedVersion: number;
  next: WorkspaceTheme;
  user: string;
}

export function updateWorkspaceTheme({
  workspaceId,
  expectedVersion,
  next,
  user,
}: UpdateThemeInput): WorkspaceTheme {
  const parsed = WorkspaceThemeSchema.safeParse(next);
  if (!parsed.success) {
    throw new ThemeValidationError(parsed.error.flatten());
  }
  const current = getWorkspaceTheme(workspaceId);
  if (current.version !== expectedVersion) {
    throw new ThemeVersionConflictError(current);
  }
  const stored: WorkspaceTheme = {
    ...parsed.data,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: user,
  };
  _store.set(workspaceId, stored);
  writeToDisk(workspaceId, stored);
  return stored;
}

export function resetWorkspaceTheme(workspaceId: string, user: string): WorkspaceTheme {
  const fresh = buildDefaultTheme(user);
  _store.set(workspaceId, fresh);
  writeToDisk(workspaceId, fresh);
  return fresh;
}

/** Test hook — clears the in-memory cache so disk read is exercised. */
export function _clearInMemoryCacheForTests(): void {
  _store.clear();
}
