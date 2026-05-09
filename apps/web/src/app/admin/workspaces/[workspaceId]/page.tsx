'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

interface QuerySettings {
  defaultRowLimit: number;
  defaultTimeoutMs: number;
}

const MAX_ROW_LIMIT = 100_000;
const MAX_TIMEOUT_S = 300;

const inputStyle: React.CSSProperties = {
  width: 144,
  height: 32,
  padding: '0 12px',
  borderRadius: 4,
  border: '1px solid var(--border-default)',
  fontSize: 13,
};

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
      <div
        style={{
          padding: '48px 24px',
          textAlign: 'center',
          fontSize: 13,
        }}
        aria-live="polite"
      >
        Loading…
      </div>
    );
  }

  return (
    <div style={{ padding: '16px 24px', maxWidth: 560 }}>
      <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Workspace settings</h1>
      <p className="font-mono text-sm" style={{ fontSize: 11, marginBottom: 24 }}>
        {workspaceId}
      </p>

      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <span className="text-sm font-semibold">Query console defaults</span>
        </div>
        <p style={{ fontSize: 12, marginBottom: 16 }}>
          These defaults apply to all users in this workspace unless they have the{' '}
          <code
            style={{
              borderRadius: 3,
              padding: '1px 4px',
              fontFamily: 'monospace',
              fontSize: 11,
            }}
          >
            query.large_result
          </code>{' '}
          or{' '}
          <code
            style={{
              borderRadius: 3,
              padding: '1px 4px',
              fontFamily: 'monospace',
              fontSize: 11,
            }}
          >
            query.long_running
          </code>{' '}
          permissions.
        </p>

        <form
          onSubmit={(e) => {
            void handleSave(e);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          noValidate
        >
          <div>
            <label
              htmlFor="rowLimit"
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 500,
                marginBottom: 6,
              }}
            >
              Default row limit
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                style={inputStyle}
                aria-describedby="rowLimit-hint"
              />
              <span id="rowLimit-hint" style={{ fontSize: 12 }}>
                rows (max {MAX_ROW_LIMIT.toLocaleString()})
              </span>
            </div>
            <p style={{ marginTop: 4, fontSize: 11 }}>
              Current platform default: {settings.defaultRowLimit.toLocaleString()} rows
            </p>
          </div>

          <div>
            <label
              htmlFor="timeoutS"
              style={{
                display: 'block',
                fontSize: 12,
                fontWeight: 500,
                marginBottom: 6,
              }}
            >
              Default query timeout
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                style={inputStyle}
                aria-describedby="timeout-hint"
              />
              <span id="timeout-hint" style={{ fontSize: 12 }}>
                seconds (max {MAX_TIMEOUT_S}s / 5 min)
              </span>
            </div>
            <p style={{ marginTop: 4, fontSize: 11 }}>
              Current platform default: {Math.round(settings.defaultTimeoutMs / 1000)}s
            </p>
          </div>

          {error && (
            <p role="alert" style={{ fontSize: 13 }}>
              {error}
            </p>
          )}
          {saved && (
            <p role="status" style={{ fontSize: 13 }}>
              Settings saved.
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button size="sm" type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
