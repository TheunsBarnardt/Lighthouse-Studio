'use client';

import type { ChangeEvent } from 'react';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

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
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      {/* Page header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1>General Settings</h1>
          <p className="subtitle">Workspace: Acme Corp</p>
        </div>
      </div>

      {/* Top 2-column grid */}
      <div className="grid grid-cols-2 gap-4" style={{ marginBottom: 16 }}>
        {/* Workspace card */}
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">Workspace</div>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Name */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor="ws-name" style={{ fontSize: 12, fontWeight: 500 }}>
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
              <label htmlFor="ws-slug" style={{ fontSize: 12, fontWeight: 500 }}>
                Slug
              </label>
              <input
                id="ws-slug"
                className="input input-h32 font-mono text-sm"
                value={slug}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setSlug(e.target.value);
                }}
              />
            </div>

            {/* Database type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label htmlFor="ws-db" style={{ fontSize: 12, fontWeight: 500 }}>
                Database type
              </label>
              <select id="ws-db" className="select input-h32" defaultValue="postgres" disabled>
                <option value="postgres">PostgreSQL</option>
                <option value="mssql">Microsoft SQL Server</option>
                <option value="mongodb">MongoDB</option>
              </select>
              <p style={{ fontSize: 12, margin: 0 }}>
                Workspace database is locked once data exists. Migrate via Stage 5.
              </p>
            </div>

            <div style={{ paddingTop: 4 }}>
              <Button size="sm" type="button">
                Save changes
              </Button>
            </div>
          </div>
        </div>

        {/* AI Providers card */}
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">AI Providers</div>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {AI_PROVIDERS.map((provider) => (
              <div
                key={provider.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  background: 'var(--muted)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {provider.name}
                  </span>
                  {provider.role && <span style={{ fontSize: 12 }}>({provider.role})</span>}
                </div>
                <span
                  className={
                    provider.status === 'active'
                      ? 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground'
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
              <Button variant="outline" size="sm" type="button">
                Configure
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* AI Token Budget â€” full width */}
      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">AI Token Budget â€” this month</div>
        </div>
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Budget bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>
                Used <strong>${BUDGET_USED.toFixed(2)}</strong>
              </span>
              <span>
                Budget <strong>${BUDGET_TOTAL.toFixed(2)}</strong>
              </span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${String(BUDGET_PCT)}%` }} />
            </div>
            <p style={{ fontSize: 12, margin: 0 }}>
              {String(BUDGET_PCT)}% used Â· 16 days remaining in cycle
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
              }}
            >
              Top consumers
            </p>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full border-collapse text-sm">
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
                      <td style={{ fontWeight: 500 }}>{row.name}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right' }}>
                        {row.spend}
                      </td>
                      <td className="tabular-nums" style={{ textAlign: 'right' }}>
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
