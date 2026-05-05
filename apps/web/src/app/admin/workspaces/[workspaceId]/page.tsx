'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface QuerySettings {
  defaultRowLimit: number;
  defaultTimeoutMs: number;
}

const MAX_ROW_LIMIT = 100_000;
const MAX_TIMEOUT_S = 300;

export default function WorkspaceAdminPage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;

  const [settings, setSettings] = useState<QuerySettings>({
    defaultRowLimit: 1000,
    defaultTimeoutMs: 30_000,
  });
  const [rowLimit, setRowLimit] = useState('1000');
  const [timeoutS, setTimeoutS] = useState('30');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch(`/api/v1/admin/workspaces/${workspaceId}/query-settings`, {
          credentials: 'include',
        });
        if (r.ok) {
          const d = (await r.json()) as QuerySettings;
          setSettings(d);
          setRowLimit(String(d.defaultRowLimit));
          setTimeoutS(String(Math.round(d.defaultTimeoutMs / 1000)));
        }
      } catch {
        // ignore — defaults remain
      } finally {
        setLoading(false);
      }
    })();
  }, [workspaceId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const parsedRowLimit = parseInt(rowLimit, 10);
    const parsedTimeoutS = parseInt(timeoutS, 10);

    if (isNaN(parsedRowLimit) || parsedRowLimit < 1 || parsedRowLimit > MAX_ROW_LIMIT) {
      setError(`Row limit must be between 1 and ${MAX_ROW_LIMIT.toLocaleString()}.`);
      return;
    }
    if (isNaN(parsedTimeoutS) || parsedTimeoutS < 1 || parsedTimeoutS > MAX_TIMEOUT_S) {
      setError(`Timeout must be between 1 and ${String(MAX_TIMEOUT_S)} seconds.`);
      return;
    }

    setSaving(true);
    try {
      const r = await fetch(`/api/v1/admin/workspaces/${workspaceId}/query-settings`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultRowLimit: parsedRowLimit,
          defaultTimeoutMs: parsedTimeoutS * 1000,
        }),
      });
      if (!r.ok) {
        const d = (await r.json()) as { message?: string };
        setError(d.message ?? 'Failed to save settings.');
        return;
      }
      const d = (await r.json()) as QuerySettings;
      setSettings(d);
      setSaved(true);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground" aria-live="polite">
        Loading…
      </p>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Workspace settings</h1>
        <p className="mt-1 text-sm text-muted-foreground font-mono">{workspaceId}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <h2 className="text-base font-semibold">Query console defaults</h2>
          <p className="text-sm text-muted-foreground">
            These defaults apply to all users in this workspace unless they have the{' '}
            <code className="rounded bg-muted px-1">query.large_result</code> or{' '}
            <code className="rounded bg-muted px-1">query.long_running</code> permissions.
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              void handleSave(e);
            }}
            className="space-y-4"
          >
            <div className="space-y-1">
              <label htmlFor="rowLimit" className="text-sm font-medium">
                Default row limit
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="rowLimit"
                  type="number"
                  min={1}
                  max={MAX_ROW_LIMIT}
                  step={100}
                  value={rowLimit}
                  onChange={(e) => {
                    setRowLimit(e.target.value);
                    setSaved(false);
                  }}
                  className="w-36 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-describedby="rowLimit-hint"
                />
                <span id="rowLimit-hint" className="text-xs text-muted-foreground">
                  rows (max {MAX_ROW_LIMIT.toLocaleString()})
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Current platform default: {settings.defaultRowLimit.toLocaleString()} rows
              </p>
            </div>

            <div className="space-y-1">
              <label htmlFor="timeoutS" className="text-sm font-medium">
                Default query timeout
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="timeoutS"
                  type="number"
                  min={1}
                  max={MAX_TIMEOUT_S}
                  step={5}
                  value={timeoutS}
                  onChange={(e) => {
                    setTimeoutS(e.target.value);
                    setSaved(false);
                  }}
                  className="w-36 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-describedby="timeout-hint"
                />
                <span id="timeout-hint" className="text-xs text-muted-foreground">
                  seconds (max {MAX_TIMEOUT_S}s / 5 min)
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Current platform default: {Math.round(settings.defaultTimeoutMs / 1000)}s
              </p>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {saved && (
              <p role="status" className="text-sm text-green-600 dark:text-green-400">
                Settings saved.
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
