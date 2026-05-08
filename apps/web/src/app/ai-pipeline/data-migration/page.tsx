'use client';

import Link from 'next/link';
import { useState } from 'react';

import { PipelineStepper } from '../page';

type MigrationMode = 'skip' | 'configure';

export default function DataMigrationPage() {
  const [mode, setMode] = useState<MigrationMode>('skip');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PipelineStepper active="data-migration" />

      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-canvas)' }}>
        <div className="pg-page" style={{ maxWidth: 800 }}>
          <div className="pg-page-header">
            <div>
              <h1>Data Migration</h1>
              <div className="subtitle">Optional stage · Skipped for greenfield projects</div>
            </div>
          </div>

          {mode === 'skip' && (
            <>
              <div className="pg-card" style={{ textAlign: 'center', padding: 48 }}>
                <div style={{ fontSize: 32, marginBottom: 16, color: 'var(--fg-tertiary)' }}>⊘</div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 15,
                    marginBottom: 8,
                    color: 'var(--fg-primary)',
                  }}
                >
                  No migration needed
                </div>
                <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginBottom: 24 }}>
                  This is a new project with no existing data to migrate.
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button
                    onClick={() => {
                      setMode('configure');
                    }}
                    className="pg-btn pg-btn-secondary pg-btn-sm"
                  >
                    Configure migration anyway
                  </button>
                  <Link
                    href="/ai-pipeline/ui-generation"
                    className="pg-btn pg-btn-primary pg-btn-sm"
                  >
                    Skip to UI generation →
                  </Link>
                </div>
              </div>

              <div className="pg-card pg-mt-4">
                <div className="pg-card-header">
                  <span className="pg-card-title">When to use this stage</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--fg-secondary)', lineHeight: '20px' }}>
                  Use the data migration stage when bringing existing data into a new schema — for
                  example, migrating from a CSV export, a legacy SQL Server database, or a
                  spreadsheet. The platform generates schema-aware import scripts with column
                  mapping, PII handling, and dry-run validation before applying.
                </p>

                <div style={{ marginTop: 20 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--fg-secondary)',
                      marginBottom: 12,
                    }}
                  >
                    Supported sources
                  </div>
                  <div className="pg-grid pg-grid-3">
                    {[
                      { icon: '📄', label: 'CSV / Excel', desc: 'Spreadsheet exports' },
                      { icon: '🗄', label: 'SQL Server', desc: 'MSSQL direct connection' },
                      { icon: '🐘', label: 'PostgreSQL', desc: 'Existing Postgres DB' },
                      { icon: '🍃', label: 'MongoDB', desc: 'Document collections' },
                      { icon: '☁', label: 'Airtable', desc: 'Base export via API' },
                      { icon: '📊', label: 'Salesforce', desc: 'Object export via API' },
                    ].map((source) => (
                      <div
                        key={source.label}
                        style={{
                          padding: 12,
                          border: '1px solid var(--border-default)',
                          borderRadius: 'var(--shell-radius-sm)',
                          background: 'var(--bg-canvas)',
                        }}
                      >
                        <div style={{ fontSize: 18, marginBottom: 4 }}>{source.icon}</div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-primary)' }}>
                          {source.label}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>
                          {source.desc}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {mode === 'configure' && (
            <div className="pg-card">
              <div className="pg-card-header">
                <span className="pg-card-title">Configure migration source</span>
                <button
                  onClick={() => {
                    setMode('skip');
                  }}
                  className="pg-btn pg-btn-ghost pg-btn-sm"
                >
                  ← Back
                </button>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    marginBottom: 8,
                    color: 'var(--fg-primary)',
                  }}
                >
                  Source type
                </div>
                <div className="pg-grid pg-grid-3" style={{ gap: 8 }}>
                  {[
                    { value: 'csv', label: 'CSV / Excel' },
                    { value: 'postgres', label: 'PostgreSQL' },
                    { value: 'mssql', label: 'SQL Server' },
                    { value: 'mongodb', label: 'MongoDB' },
                    { value: 'airtable', label: 'Airtable' },
                    { value: 'salesforce', label: 'Salesforce' },
                  ].map((source) => (
                    <button
                      key={source.value}
                      className="pg-btn pg-btn-secondary"
                      style={{ justifyContent: 'center', fontSize: 12 }}
                    >
                      {source.label}
                    </button>
                  ))}
                </div>
              </div>
              <div
                style={{
                  padding: 20,
                  background: 'var(--bg-canvas)',
                  borderRadius: 'var(--shell-radius-md)',
                  border: '1px solid var(--border-default)',
                  textAlign: 'center',
                  color: 'var(--fg-tertiary)',
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
