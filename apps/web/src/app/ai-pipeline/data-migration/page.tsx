'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { PipelineStepper } from '../stepper';

type MigrationMode = 'skip' | 'configure';

export default function DataMigrationPage() {
  const [mode, setMode] = useState<MigrationMode>('skip');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PipelineStepper active="data-migration" />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 800 }}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h1>Data Migration</h1>
              <div className="subtitle">Optional stage Â· Skipped for greenfield projects</div>
            </div>
          </div>

          {mode === 'skip' && (
            <>
              <div
                className="rounded-md border bg-card text-card-foreground p-4"
                style={{ textAlign: 'center', padding: 48 }}
              >
                <div style={{ fontSize: 32, marginBottom: 16 }}>âŠ˜</div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 15,
                    marginBottom: 8,
                  }}
                >
                  No migration needed
                </div>
                <div style={{ fontSize: 13, marginBottom: 24 }}>
                  This is a new project with no existing data to migrate.
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <Button
                    onClick={() => {
                      setMode('configure');
                    }}
                    className="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                  >
                    Configure migration anyway
                  </Button>
                  <Link
                    href="/ai-pipeline/ui-generation"
                    className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Skip to UI generation â†’
                  </Link>
                </div>
              </div>

              <div className="rounded-md border bg-card text-card-foreground p-4 mt-4">
                <div className="mb-3 flex items-center justify-between border-b pb-3">
                  <span className="text-sm font-semibold">When to use this stage</span>
                </div>
                <p style={{ fontSize: 13, lineHeight: '20px' }}>
                  Use the data migration stage when bringing existing data into a new schema â€” for
                  example, migrating from a CSV export, a legacy SQL Server database, or a
                  spreadsheet. The platform generates schema-aware import scripts with column
                  mapping, PII handling, and dry-run validation before applying.
                </p>

                <div style={{ marginTop: 20 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      marginBottom: 12,
                    }}
                  >
                    Supported sources
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { icon: 'ðŸ“„', label: 'CSV / Excel', desc: 'Spreadsheet exports' },
                      { icon: 'ðŸ—„', label: 'SQL Server', desc: 'MSSQL direct connection' },
                      { icon: 'ðŸ˜', label: 'PostgreSQL', desc: 'Existing Postgres DB' },
                      { icon: 'ðŸƒ', label: 'MongoDB', desc: 'Document collections' },
                      { icon: 'â˜', label: 'Airtable', desc: 'Base export via API' },
                      { icon: 'ðŸ“Š', label: 'Salesforce', desc: 'Object export via API' },
                    ].map((source) => (
                      <div
                        key={source.label}
                        style={{
                          padding: 12,
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                        }}
                      >
                        <div style={{ fontSize: 18, marginBottom: 4 }}>{source.icon}</div>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{source.label}</div>
                        <div style={{ fontSize: 11 }}>{source.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {mode === 'configure' && (
            <div className="rounded-md border bg-card text-card-foreground p-4">
              <div className="mb-3 flex items-center justify-between border-b pb-3">
                <span className="text-sm font-semibold">Configure migration source</span>
                <Button
                  onClick={() => {
                    setMode('skip');
                  }}
                  className=""
                >
                  â† Back
                </Button>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    marginBottom: 8,
                  }}
                >
                  Source type
                </div>
                <div className="grid grid-cols-3 gap-4" style={{ gap: 8 }}>
                  {[
                    { value: 'csv', label: 'CSV / Excel' },
                    { value: 'postgres', label: 'PostgreSQL' },
                    { value: 'mssql', label: 'SQL Server' },
                    { value: 'mongodb', label: 'MongoDB' },
                    { value: 'airtable', label: 'Airtable' },
                    { value: 'salesforce', label: 'Salesforce' },
                  ].map((source) => (
                    <Button
                      variant="outline"
                      type="button"
                      key={source.value}
                      style={{ justifyContent: 'center', fontSize: 12 }}
                    >
                      {source.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div
                style={{
                  padding: 20,
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  textAlign: 'center',
                  fontSize: 13,
                }}
              >
                Select a source type to begin configuration
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
