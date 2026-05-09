'use client';
/* eslint-disable no-restricted-syntax */
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import type { SchemaVersion } from '@/lib/types';

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
    <div style={{ padding: '16px 24px' }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Version History</h2>

      {isLoading && (
        <div
          style={{
            padding: '48px 0',
            textAlign: 'center',
            fontSize: 13,
          }}
          aria-live="polite"
        >
          Loading history…
        </div>
      )}

      {error && (
        <div
          style={{
            marginBottom: 16,
            borderRadius: 4,
            background: 'var(--bg-danger-subtle)',
            padding: '12px 16px',
            fontSize: 13,
          }}
          role="alert"
        >
          {error}
        </div>
      )}

      {!isLoading && versions.length === 0 && (
        <p style={{ fontSize: 13 }}>No versions recorded yet.</p>
      )}

      {!isLoading && versions.length > 0 && (
        <ol
          style={{
            position: 'relative',
            borderLeft: '1px solid var(--border-default)',
            paddingLeft: 24,
          }}
          aria-label="Version history"
        >
          {versions.map((v) => (
            <li key={v.version} style={{ marginBottom: 24, position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: -33,
                  top: 2,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-hidden="true"
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>v{v.version}</span>
                    {v.version === latest && (
                      <span
                        className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                        style={{ fontSize: 10 }}
                      >
                        latest
                      </span>
                    )}
                  </div>
                  {v.description && <p style={{ marginTop: 2, fontSize: 13 }}>{v.description}</p>}
                  <div style={{ marginTop: 4, fontSize: 11 }}>
                    {v.tables.length} {v.tables.length === 1 ? 'table' : 'tables'}
                    {' · '}
                    {v.createdBy}
                    {' · '}
                    {new Date(v.createdAt).toLocaleString()}
                  </div>
                </div>
                {v.version !== latest && (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
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
