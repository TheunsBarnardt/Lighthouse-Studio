'use client';
/* eslint-disable no-restricted-syntax */
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import type { SchemaVersion } from '@/lib/types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { schemaApi } from '@/lib/api-client';

const DEFAULT_WORKSPACE_ID = process.env['NEXT_PUBLIC_DEFAULT_WORKSPACE_ID'] ?? 'default';

export default function HistoryPage() {
  const params = useParams<{ schemaSlug: string }>();
  const [versions, setVersions] = useState<SchemaVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rolling, setRolling] = useState<number | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await schemaApi.listVersions(DEFAULT_WORKSPACE_ID, params.schemaSlug);
      setVersions(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load version history.');
    } finally {
      setIsLoading(false);
    }
  }, [params.schemaSlug]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRollback = async (version: number) => {
    setRolling(version);
    try {
      await schemaApi.rollback(DEFAULT_WORKSPACE_ID, params.schemaSlug, version);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rollback failed.');
    } finally {
      setRolling(null);
    }
  };

  const latest = versions[0]?.version;

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold">Version History</h2>

      {isLoading && (
        <div className="py-12 text-center text-sm text-muted-foreground" aria-live="polite">
          Loading history…
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error" role="alert">
          {error}
        </div>
      )}

      {!isLoading && versions.length === 0 && (
        <p className="text-muted-foreground">No versions recorded yet.</p>
      )}

      {!isLoading && versions.length > 0 && (
        <ol className="relative border-l border-border pl-6" aria-label="Version history">
          {versions.map((v) => (
            <li key={v.version} className="mb-6">
              <span
                className="absolute -left-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card"
                aria-hidden="true"
              />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">v{v.version}</span>
                    {v.version === latest && (
                      <Badge variant="secondary" className="text-xs">
                        latest
                      </Badge>
                    )}
                  </div>
                  {v.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{v.description}</p>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {v.tables.length} {v.tables.length === 1 ? 'table' : 'tables'}
                    {' · '}
                    {v.createdBy}
                    {' · '}
                    {new Date(v.createdAt).toLocaleString()}
                  </div>
                </div>
                {v.version !== latest && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void handleRollback(v.version);
                    }}
                    disabled={rolling !== null}
                    aria-label={`Rollback to version ${String(v.version)}`}
                  >
                    {rolling === v.version ? 'Rolling back…' : 'Rollback'}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
