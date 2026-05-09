'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

interface DbStatus {
  id: string;
  kind: string;
  currentVersion: string | null;
  appliedAt: string | null;
  appliedBy: string | null;
  needsUpgrade: boolean;
}

interface UpgradeStatus {
  codeVersion: string;
  upgradeInProgress: boolean;
  dbs: DbStatus[];
}

interface HistoryEntry {
  releaseVersion: string;
  appliedAt: string;
  appliedBy: string | null;
  schemaMigrationHighWater: string | null;
}

type UpgradePhase = 'idle' | 'dry-run' | 'running' | 'done' | 'error';

interface LogLine {
  ts: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

function kindBadgeStyle(kind: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    postgres: {
      border: '1px solid var(--accent-primary)',
    },
    mssql: {
      border: '1px solid var(--fg-warning)',
    },
    mongo: {
      border: '1px solid var(--fg-success)',
    },
  };
  return map[kind] ?? {};
}

export default function AdminUpgradePage() {
  const [status, setStatus] = useState<UpgradeStatus | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<UpgradePhase>('idle');
  const [log, setLog] = useState<LogLine[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((message: string, type: LogLine['type'] = 'info') => {
    setLog((prev) => [...prev, { ts: new Date().toLocaleTimeString(), message, type }]);
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const [sr, hr] = await Promise.all([
        fetch('/api/v1/admin/upgrade/status', { credentials: 'include' }),
        fetch('/api/v1/admin/upgrade/history', { credentials: 'include' }),
      ]);
      if (sr.ok) setStatus((await sr.json()) as UpgradeStatus);
      if (hr.ok) {
        const { entries } = (await hr.json()) as { entries: HistoryEntry[] };
        setHistory(entries);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  useEffect(() => {
    if (phase !== 'running') return;
    const interval = setInterval(() => {
      void (async () => {
        await loadStatus();
        setStatus((prev) => {
          if (prev && !prev.upgradeInProgress) {
            setPhase('done');
            addLog('Upgrade completed successfully.', 'success');
          }
          return prev;
        });
      })();
    }, 1500);
    return () => {
      clearInterval(interval);
    };
  }, [phase, loadStatus, addLog]);

  async function runDryRun() {
    setPhase('dry-run');
    setLog([]);
    addLog('Starting pre-flight dry run…');
    try {
      const r = await fetch('/api/v1/admin/upgrade', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: true }),
      });
      const data = (await r.json()) as { message?: string };
      addLog(data.message ?? 'Dry run completed.', r.ok ? 'success' : 'error');
      setPhase(r.ok ? 'idle' : 'error');
    } catch (e) {
      addLog(`Dry run failed: ${String(e)}`, 'error');
      setPhase('error');
    }
  }

  async function runUpgrade() {
    setPhase('running');
    addLog('Triggering upgrade…');
    try {
      const r = await fetch('/api/v1/admin/upgrade', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      });
      const data = (await r.json()) as { message?: string };
      if (!r.ok) {
        addLog(data.message ?? 'Upgrade failed to start.', 'error');
        setPhase('error');
        return;
      }
      addLog(data.message ?? 'Upgrade started. Waiting for completion…');
      await loadStatus();
    } catch (e) {
      addLog(`Upgrade failed: ${String(e)}`, 'error');
      setPhase('error');
    }
  }

  const allUpToDate = status?.dbs.every((d) => !d.needsUpgrade) ?? false;
  const busy = phase === 'running' || phase === 'dry-run' || (status?.upgradeInProgress ?? false);

  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Platform upgrade</h1>
          {status && (
            <div style={{ fontSize: 13, marginTop: 4 }}>
              Code version:{' '}
              <span className="font-mono text-sm" style={{ fontWeight: 500 }}>
                {status.codeVersion}
              </span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={busy || allUpToDate}
            onClick={() => {
              void runDryRun();
            }}
          >
            Dry run
          </Button>
          <Button
            size="sm"
            type="button"
            disabled={busy || allUpToDate}
            onClick={() => {
              void runUpgrade();
            }}
          >
            {busy ? 'Upgrading…' : 'Run upgrade'}
          </Button>
        </div>
      </div>

      {/* Database status */}
      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ marginBottom: 16 }}
      >
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <span className="text-sm font-semibold">Database versions</span>
        </div>
        {loading && (
          <p
            style={{
              padding: '32px 0',
              textAlign: 'center',
              fontSize: 13,
            }}
            aria-live="polite"
          >
            Loading…
          </p>
        )}
        {!loading && (!status || status.dbs.length === 0) && (
          <p
            style={{
              padding: '32px 0',
              textAlign: 'center',
              fontSize: 13,
            }}
          >
            No databases configured.
          </p>
        )}
        {!loading && status && status.dbs.length > 0 && (
          <div className="overflow-hidden rounded-md border" style={{ marginTop: 0 }}>
            <table
              className="w-full border-collapse text-sm"
              role="grid"
              aria-label="Database version status"
            >
              <thead>
                <tr>
                  <th>Database</th>
                  <th>Type</th>
                  <th>Current version</th>
                  <th>Applied at</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {status.dbs.map((db) => (
                  <tr key={db.id}>
                    <td className="font-mono text-sm" style={{ fontSize: 11 }}>
                      {db.id}
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          borderRadius: 3,
                          padding: '1px 6px',
                          fontSize: 11,
                          fontWeight: 500,
                          ...kindBadgeStyle(db.kind),
                        }}
                      >
                        {db.kind}
                      </span>
                    </td>
                    <td className="font-mono text-sm" style={{ fontSize: 11 }}>
                      {db.currentVersion ?? (
                        <span style={{ fontStyle: 'italic' }}>fresh install</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {db.appliedAt ? (
                        new Date(db.appliedAt).toLocaleString()
                      ) : (
                        <span style={{ fontStyle: 'italic' }}>—</span>
                      )}
                    </td>
                    <td>
                      {db.needsUpgrade ? (
                        <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                          Needs upgrade
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          Up to date
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {allUpToDate && !loading && (
          <p style={{ marginTop: 12, textAlign: 'center', fontSize: 13 }}>
            All databases are up to date.
          </p>
        )}
      </div>

      {/* Progress log */}
      {log.length > 0 && (
        <div
          className="rounded-md border bg-card text-card-foreground p-4"
          style={{ marginBottom: 16 }}
        >
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <span className="text-sm font-semibold">
              Upgrade log
              {busy && (
                <span
                  style={{
                    marginLeft: 8,
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--fg-warning)',
                  }}
                  aria-hidden="true"
                />
              )}
            </span>
          </div>
          <div
            ref={logRef}
            style={{
              height: 160,
              overflowY: 'auto',
              borderRadius: 4,
              border: '1px solid var(--border-default)',
              padding: '8px 12px',
              fontFamily: 'monospace',
              fontSize: 11,
            }}
            role="log"
            aria-label="Upgrade progress"
            aria-live="polite"
          >
            {log.map((line, i) => (
              <div
                key={i}
                style={{
                  color:
                    line.type === 'error'
                      ? 'var(--fg-danger)'
                      : line.type === 'success'
                        ? 'var(--fg-success)'
                        : 'var(--fg-primary)',
                }}
              >
                <span style={{ marginRight: 8 }}>[{line.ts}]</span>
                {line.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upgrade history */}
      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <span className="text-sm font-semibold">Upgrade history</span>
        </div>
        {history.length === 0 ? (
          <p
            style={{
              padding: '32px 0',
              textAlign: 'center',
              fontSize: 13,
              fontStyle: 'italic',
            }}
          >
            No upgrades recorded yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-md border" style={{ marginTop: 0 }}>
            <table
              className="w-full border-collapse text-sm"
              role="grid"
              aria-label="Upgrade history"
            >
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Applied at</th>
                  <th>Applied by</th>
                  <th>Schema high-water</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry, i) => (
                  <tr key={i}>
                    <td className="font-mono text-sm" style={{ fontSize: 11, fontWeight: 600 }}>
                      {entry.releaseVersion}
                    </td>
                    <td style={{ fontSize: 12 }}>{new Date(entry.appliedAt).toLocaleString()}</td>
                    <td style={{ fontSize: 13 }}>
                      {entry.appliedBy ?? <span style={{ fontStyle: 'italic' }}>automated</span>}
                    </td>
                    <td className="font-mono text-sm" style={{ fontSize: 11 }}>
                      {entry.schemaMigrationHighWater ?? (
                        <span style={{ fontStyle: 'italic' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
