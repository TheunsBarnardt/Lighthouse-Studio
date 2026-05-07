'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

function kindBadge(kind: string) {
  const map: Record<string, string> = {
    postgres: 'bg-blue-100 text-blue-800',
    mssql: 'bg-orange-100 text-orange-800',
    mongo: 'bg-green-100 text-green-800',
  };
  return map[kind] ?? 'bg-gray-100 text-gray-800';
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

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  // Poll while upgrade in progress
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
      // Reload status to reflect in-progress state
      await loadStatus();
    } catch (e) {
      addLog(`Upgrade failed: ${String(e)}`, 'error');
      setPhase('error');
    }
  }

  const allUpToDate = status?.dbs.every((d) => !d.needsUpgrade) ?? false;
  const busy = phase === 'running' || phase === 'dry-run' || (status?.upgradeInProgress ?? false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform upgrade</h1>
          {status && (
            <p className="mt-1 text-sm text-muted-foreground">
              Code version: <span className="font-mono font-medium">{status.codeVersion}</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy || allUpToDate}
            onClick={() => {
              void runDryRun();
            }}
          >
            Dry run
          </Button>
          <Button
            size="sm"
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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Database versions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <p className="py-4 text-center text-sm text-muted-foreground" aria-live="polite">
              Loading…
            </p>
          )}
          {!loading && (!status || status.dbs.length === 0) && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No databases configured.
            </p>
          )}
          {!loading && status && status.dbs.length > 0 && (
            <table className="w-full text-sm" role="grid" aria-label="Database version status">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Database</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Current version</th>
                  <th className="pb-2 pr-4 font-medium">Applied at</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {status.dbs.map((db) => (
                  <tr key={db.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-mono text-xs">{db.id}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${kindBadge(db.kind)}`}
                      >
                        {db.kind}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs">
                      {db.currentVersion ?? (
                        <span className="italic text-muted-foreground">fresh install</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">
                      {db.appliedAt ? (
                        new Date(db.appliedAt).toLocaleString()
                      ) : (
                        <span className="italic">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      {db.needsUpgrade ? (
                        <Badge variant="error">Needs upgrade</Badge>
                      ) : (
                        <Badge variant="secondary">Up to date</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {allUpToDate && !loading && (
            <p className="mt-3 text-center text-sm text-green-600">All databases are up to date.</p>
          )}
        </CardContent>
      </Card>

      {/* Progress log */}
      {log.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Upgrade log
              {busy && (
                <span
                  className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400"
                  aria-hidden="true"
                />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              ref={logRef}
              className="h-40 overflow-y-auto rounded bg-muted p-3 font-mono text-xs"
              role="log"
              aria-label="Upgrade progress"
              aria-live="polite"
            >
              {log.map((line, i) => (
                <div
                  key={i}
                  className={
                    line.type === 'error'
                      ? 'text-red-500'
                      : line.type === 'success'
                        ? 'text-green-600'
                        : ''
                  }
                >
                  <span className="mr-2 text-muted-foreground">[{line.ts}]</span>
                  {line.message}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upgrade history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upgrade history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground italic">
              No upgrades recorded yet.
            </p>
          ) : (
            <table className="w-full text-sm" role="grid" aria-label="Upgrade history">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Version</th>
                  <th className="pb-2 pr-4 font-medium">Applied at</th>
                  <th className="pb-2 pr-4 font-medium">Applied by</th>
                  <th className="pb-2 font-medium">Schema high-water</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-mono text-xs font-semibold">
                      {entry.releaseVersion}
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">
                      {new Date(entry.appliedAt).toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      {entry.appliedBy ?? (
                        <span className="italic text-muted-foreground">automated</span>
                      )}
                    </td>
                    <td className="py-3 font-mono text-xs text-muted-foreground">
                      {entry.schemaMigrationHighWater ?? <span className="italic">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
