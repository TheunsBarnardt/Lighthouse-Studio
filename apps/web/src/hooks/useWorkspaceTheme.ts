'use client';

import { useCallback, useEffect, useState } from 'react';

import type { WorkspaceTheme } from '@/lib/theme/types';
import { WorkspaceThemeSchema } from '@/lib/theme/types';

export interface UseWorkspaceThemeResult {
  theme: WorkspaceTheme | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  saveError: string | null;
  reload: () => Promise<void>;
  save: (next: WorkspaceTheme) => Promise<WorkspaceTheme | null>;
}

export function useWorkspaceTheme(slug: string): UseWorkspaceThemeResult {
  const [theme, setTheme] = useState<WorkspaceTheme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/workspaces/${slug}/theme`, { credentials: 'include' });
      if (!res.ok) {
        setError(`Failed to load theme (${String(res.status)})`);
        return;
      }
      const json = (await res.json()) as unknown;
      const parsed = WorkspaceThemeSchema.safeParse(json);
      if (!parsed.success) {
        setError('Theme payload is malformed.');
        return;
      }
      setTheme(parsed.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = useCallback(
    async (next: WorkspaceTheme): Promise<WorkspaceTheme | null> => {
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch(`/api/v1/workspaces/${slug}/theme`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          setSaveError(body.message ?? `Save failed (${String(res.status)})`);
          return null;
        }
        const json = (await res.json()) as unknown;
        const parsed = WorkspaceThemeSchema.safeParse(json);
        if (!parsed.success) {
          setSaveError('Server returned malformed theme.');
          return null;
        }
        setTheme(parsed.data);
        return parsed.data;
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : 'Network error');
        return null;
      } finally {
        setSaving(false);
      }
    },
    [slug],
  );

  return { theme, loading, error, saving, saveError, reload, save };
}
