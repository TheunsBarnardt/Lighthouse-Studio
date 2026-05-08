'use client';

import type { ChangeEvent } from 'react';

import { useState } from 'react';

// ---------------------------------------------------------------------------
// Types & static data
// ---------------------------------------------------------------------------

interface AiProvider {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'configured' | 'disabled';
}

const AI_PROVIDERS: AiProvider[] = [
  { id: 'anthropic', name: 'Anthropic Claude', role: 'primary', status: 'active' },
  { id: 'openai', name: 'OpenAI', role: 'fallback', status: 'configured' },
  { id: 'azure', name: 'Microsoft Azure OpenAI', role: '', status: 'disabled' },
  { id: 'ollama', name: 'Ollama (self-hosted)', role: '', status: 'disabled' },
];

interface TokenConsumer {
  name: string;
  spend: string;
  calls: number;
}

const TOKEN_CONSUMERS: TokenConsumer[] = [
  { name: 'PRD generation', spend: '$8.40', calls: 42 },
  { name: 'Schema synthesis', spend: '$6.20', calls: 18 },
  { name: 'UI generation', spend: '$5.10', calls: 31 },
  { name: 'Code generation', spend: '$3.70', calls: 24 },
];

const BUDGET_USED = 23.4;
const BUDGET_TOTAL = 50;
const BUDGET_PCT = Math.round((BUDGET_USED / BUDGET_TOTAL) * 100);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const [name, setName] = useState('Acme Corp');
  const [slug, setSlug] = useState('acme-corp');

  return (
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      {/* Page header */}
      <div className="pg-page-header">
        <div>
          <h1>General Settings</h1>
          <p className="subtitle">Workspace: Acme Corp</p>
        </div>
      </div>

      {/* Top 2-column grid */}
      <div className="pg-grid pg-grid-2" style={{ marginBottom: 16 }}>
        {/* Workspace card */}
        <div className="pg-card">
          <div className="pg-card-header">
            <div className="pg-card-title">Workspace</div>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label
                htmlFor="ws-name"
                style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-secondary)' }}
              >
                Name
              </label>
              <input
                id="ws-name"
                className="input input-h32"
                value={name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setName(e.target.value);
                }}
              />
            </div>

            {/* Slug */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label
                htmlFor="ws-slug"
                style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-secondary)' }}
              >
                Slug
              </label>
              <input
                id="ws-slug"
                className="input input-h32 pg-mono"
                value={slug}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setSlug(e.target.value);
                }}
              />
            </div>

            {/* Database type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label
                htmlFor="ws-db"
                style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-secondary)' }}
              >
                Database type
              </label>
              <select id="ws-db" className="select input-h32" defaultValue="postgres" disabled>
                <option value="postgres">PostgreSQL</option>
                <option value="mssql">Microsoft SQL Server</option>
                <option value="mongodb">MongoDB</option>
              </select>
              <p style={{ fontSize: 12, color: 'var(--fg-tertiary)', margin: 0 }}>
                Workspace database is locked once data exists. Migrate via Stage 5.
              </p>
            </div>

            <div style={{ paddingTop: 4 }}>
              <button className="pg-btn pg-btn-primary pg-btn-sm">Save changes</button>
            </div>
          </div>
        </div>

        {/* AI Providers card */}
        <div className="pg-card">
          <div className="pg-card-header">
            <div className="pg-card-title">AI Providers</div>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {AI_PROVIDERS.map((provider) => (
              <div
                key={provider.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: 'var(--shell-radius-md)',
                  padding: '8px 12px',
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border-default)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--fg-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {provider.name}
                  </span>
                  {provider.role && (
                    <span style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>
                      ({provider.role})
                    </span>
                  )}
                </div>
                <span
                  className={
                    provider.status === 'active'
                      ? 'pg-badge pg-badge-success'
                      : 'pg-badge pg-badge-default'
                  }
                >
                  {provider.status === 'active'
                    ? 'Active'
                    : provider.status === 'configured'
                      ? 'Configured'
                      : 'Disabled'}
                </span>
              </div>
            ))}

            <div style={{ paddingTop: 8 }}>
              <button className="pg-btn pg-btn-secondary pg-btn-sm">Configure</button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Token Budget — full width */}
      <div className="pg-card">
        <div className="pg-card-header">
          <div className="pg-card-title">AI Token Budget — this month</div>
        </div>
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Budget bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--fg-primary)' }}>
                Used <strong>${BUDGET_USED.toFixed(2)}</strong>
              </span>
              <span style={{ color: 'var(--fg-secondary)' }}>
                Budget <strong>${BUDGET_TOTAL.toFixed(2)}</strong>
              </span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${String(BUDGET_PCT)}%` }} />
            </div>
            <p style={{ fontSize: 12, color: 'var(--fg-tertiary)', margin: 0 }}>
              {String(BUDGET_PCT)}% used · 16 days remaining in cycle
            </p>
          </div>

          {/* Top consumers table */}
          <div>
            <p
              style={{
                marginBottom: 8,
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--fg-tertiary)',
              }}
            >
              Top consumers
            </p>
            <div className="pg-table-wrap">
              <table className="pg-data-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th style={{ textAlign: 'right' }}>Spend</th>
                    <th style={{ textAlign: 'right' }}>Calls</th>
                  </tr>
                </thead>
                <tbody>
                  {TOKEN_CONSUMERS.map((row) => (
                    <tr key={row.name}>
                      <td style={{ color: 'var(--fg-primary)', fontWeight: 500 }}>{row.name}</td>
                      <td
                        className="pg-tabular"
                        style={{ textAlign: 'right', color: 'var(--fg-secondary)' }}
                      >
                        {row.spend}
                      </td>
                      <td
                        className="pg-tabular"
                        style={{ textAlign: 'right', color: 'var(--fg-secondary)' }}
                      >
                        {String(row.calls)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
