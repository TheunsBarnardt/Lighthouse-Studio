'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Suspense } from 'react';

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

interface Column {
  name: string;
  type: string;
  pk?: boolean;
  fk?: boolean;
}

interface TableSchema {
  columns: Column[];
  rows: (string | number)[][];
}

interface TableMeta {
  name: string;
  rls: string;
  rows: number;
}

const MOCK_TABLES: TableMeta[] = [
  { name: 'contacts', rls: 'off', rows: 1247 },
  { name: 'deals', rls: 'off', rows: 342 },
  { name: 'activities', rls: 'off', rows: 4891 },
  { name: 'users', rls: 'on', rows: 24 },
  { name: 'tags', rls: 'off', rows: 18 },
  { name: 'contact_tags', rls: 'off', rows: 847 },
  { name: 'audit_log', rls: 'on', rows: 12084 },
  { name: 'sessions', rls: 'on', rows: 142 },
];

const TABLE_SCHEMAS: Record<string, TableSchema> = {
  contacts: {
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'name', type: 'text' },
      { name: 'email', type: 'text' },
      { name: 'company', type: 'text' },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'workspace_id', type: 'uuid', fk: true },
      { name: 'stage', type: 'text' },
      { name: 'notes', type: 'text' },
    ],
    rows: [
      [
        'a1b2c3d4-e5f6-...',
        'Alice Schwartz',
        'alice@beta.co',
        'Beta Co',
        '2026-05-06 10:00',
        'ws-001',
        'qualified',
        'Key account',
      ],
      [
        'b2c3d4e5-f6a7-...',
        'Carlos Ruiz',
        'carlos@globex.io',
        'Globex',
        '2026-05-04 14:22',
        'ws-001',
        'proposal',
        '',
      ],
      [
        'c3d4e5f6-a7b8-...',
        'Yuki Tanaka',
        'yuki@initech.jp',
        'Initech',
        '2026-05-07 09:11',
        'ws-001',
        'negotiation',
        'VIP',
      ],
      [
        'd4e5f6a7-b8c9-...',
        'Priya Patel',
        'priya@acme.com',
        'Acme Corp',
        '2026-05-02 16:45',
        'ws-001',
        'lead',
        '',
      ],
      [
        'e5f6a7b8-c9d0-...',
        'Omar Hassan',
        'omar@vantage.io',
        'Vantage',
        '2026-04-28 11:30',
        'ws-001',
        'qualified',
        'Referred',
      ],
    ],
  },
  deals: {
    columns: [
      { name: 'id', type: 'uuid', pk: true },
      { name: 'contact_id', type: 'uuid', fk: true },
      { name: 'title', type: 'text' },
      { name: 'amount', type: 'numeric' },
      { name: 'stage', type: 'text' },
      { name: 'owner_id', type: 'uuid', fk: true },
      { name: 'created_at', type: 'timestamptz' },
      { name: 'closed_at', type: 'timestamptz' },
      { name: 'workspace_id', type: 'uuid', fk: true },
    ],
    rows: [
      [
        'f1e2d3c4-b5a6-...',
        'a1b2c3d4-e5f6-...',
        'Enterprise license',
        48000,
        'negotiation',
        'u-001',
        '2026-04-10 09:00',
        '',
        'ws-001',
      ],
      [
        'g2f3e4d5-c6b7-...',
        'b2c3d4e5-f6a7-...',
        'Pro plan upgrade',
        12000,
        'proposal',
        'u-002',
        '2026-04-15 11:00',
        '',
        'ws-001',
      ],
      [
        'h3g4f5e6-d7c8-...',
        'c3d4e5f6-a7b8-...',
        'Consulting retainer',
        24000,
        'qualified',
        'u-001',
        '2026-05-01 14:00',
        '',
        'ws-001',
      ],
    ],
  },
};

function getSchema(name: string): TableSchema {
  return TABLE_SCHEMAS[name] ?? TABLE_SCHEMAS['contacts'];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function _RlsBadge({ rls }: { rls: string }) {
  const isOn = rls === 'on';
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: '9px',
        fontWeight: 600,
        padding: '1px 4px',
        borderRadius: '3px',
        background: isOn ? 'oklch(0.45 0.18 145 / 0.15)' : 'oklch(0.45 0.18 25 / 0.15)',
        color: isOn ? 'oklch(0.40 0.14 145)' : 'oklch(0.45 0.18 25)',
        letterSpacing: '0.04em',
      }}
    >
      {rls.toUpperCase()}
    </span>
  );
}

function DataGrid({ tableName }: { tableName: string }) {
  const schema = getSchema(tableName);
  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          fontSize: '12px',
          tableLayout: 'auto',
        }}
      >
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th
              style={{
                width: 32,
                padding: '0 8px',
                position: 'sticky',
                left: 0,
                background: 'var(--card)',
                zIndex: 3,
                borderRight: '1px solid var(--border)',
              }}
            >
              <input type="checkbox" style={{ margin: 0 }} aria-label="Select all" />
            </th>
            {schema.columns.map((col) => (
              <th
                key={col.name}
                style={{
                  padding: '6px 10px',
                  textAlign: 'left',
                  fontWeight: 500,
                  color: 'var(--muted-foreground)',
                  borderRight: '1px solid var(--border)',
                  whiteSpace: 'nowrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {col.pk && (
                    <span title="Primary key" style={{ fontSize: 11 }}>
                      ðŸ”‘
                    </span>
                  )}
                  {col.fk && (
                    <span title="Foreign key" style={{ fontSize: 11 }}>
                      â›“
                    </span>
                  )}
                  <span style={{ color: 'var(--foreground)' }}>{col.name}</span>
                  <span
                    style={{
                      fontSize: 10,
                      color: 'var(--muted-foreground)',
                      background: 'var(--muted)',
                      borderRadius: 3,
                      padding: '0 4px',
                    }}
                  >
                    {col.type}
                  </span>
                  <span style={{ color: 'var(--muted-foreground)', fontSize: 10 }}>â–¾</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schema.rows.map((row, ri) => (
            <tr
              key={ri}
              style={{ borderBottom: '1px solid var(--border)' }}
              className="te-row"
            >
              <td
                style={{
                  padding: '0 8px',
                  position: 'sticky',
                  left: 0,
                  background: 'var(--card)',
                  zIndex: 1,
                  borderRight: '1px solid var(--border)',
                }}
              >
                <input
                  type="checkbox"
                  style={{ margin: 0 }}
                  aria-label={`Select row ${String(ri + 1)}`}
                />
              </td>
              {row.map((cell, ci) => {
                const col = schema.columns[ci];
                const isUuid = col.type === 'uuid';
                return (
                  <td
                    key={ci}
                    style={{
                      padding: '5px 10px',
                      fontFamily: isUuid ? 'var(--font-geist-mono, monospace)' : undefined,
                      fontSize: isUuid ? 11 : 12,
                      color: isUuid ? 'var(--muted-foreground)' : 'var(--foreground)',
                      borderRight: '1px solid var(--border)',
                      maxWidth: 240,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {String(cell)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function TableEditorInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [openTables, setOpenTables] = useState<string[]>(['contacts', 'deals']);
  const [activeTable, setActiveTable] = useState<string>('contacts');
  const [tableSearch, _setTableSearch] = useState('');

  // Sync from URL param ?table=xxx
  useEffect(() => {
    const t = searchParams.get('table');
    if (t) {
      setActiveTable(t);
      setOpenTables((prev) => (prev.includes(t) ? prev : [...prev, t]));
    }
  }, [searchParams]);

  function openTable(name: string) {
    setActiveTable(name);
    if (!openTables.includes(name)) {
      setOpenTables((prev) => [...prev, name]);
    }
    router.replace(`/data-management?table=${name}`, { scroll: false });
  }

  function closeTab(name: string, e: React.MouseEvent) {
    e.stopPropagation();
    const next = openTables.filter((t) => t !== name);
    setOpenTables(next);
    if (activeTable === name) {
      const fallback = next[0] ?? '';
      setActiveTable(fallback);
      if (fallback) router.replace(`/data-management?table=${fallback}`, { scroll: false });
    }
  }

  const _filteredTables = MOCK_TABLES.filter((t) =>
    t.name.toLowerCase().includes(tableSearch.toLowerCase()),
  );

  const activeMeta = MOCK_TABLES.find((t) => t.name === activeTable);

  // Shared border / bg tokens used inline
  const border = 'var(--border)';
  const bgSurface = 'var(--card)';
  const bgCanvas = 'var(--background)';
  const fgPrimary = 'var(--foreground)';
  const fgSecondary = 'var(--muted-foreground)';
  const fgTertiary = 'var(--muted-foreground)';
  const accentPrimary = 'var(--primary)';
  const accentSubtle = 'var(--primary)';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: bgCanvas,
      }}
    >
      {/* ----------------------------------------------------------------
          Tab row
      ---------------------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: `1px solid ${border}`,
          background: bgSurface,
          minHeight: 36,
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {openTables.map((t) => {
          const isActive = t === activeTable;
          return (
            <button
              key={t}
              onClick={() => {
                openTable(t);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '0 10px',
                height: 36,
                fontSize: 12,
                border: 'none',
                borderRight: `1px solid ${border}`,
                background: isActive ? bgCanvas : 'transparent',
                color: isActive ? fgPrimary : fgSecondary,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                borderBottom: isActive ? `2px solid ${accentPrimary}` : '2px solid transparent',
              }}
            >
              <span style={{ fontSize: 11, color: fgTertiary }}>â–¦</span>
              <span>
                <span style={{ color: fgTertiary }}>public.</span>
                <strong>{t}</strong>
              </span>
              <span
                onClick={(e) => {
                  closeTab(t, e);
                }}
                style={{
                  marginLeft: 2,
                  color: fgTertiary,
                  fontSize: 11,
                  lineHeight: 1,
                  cursor: 'pointer',
                  padding: '0 2px',
                }}
                aria-label={`Close ${t} tab`}
              >
                âœ•
              </span>
            </button>
          );
        })}
        <button
          style={{
            padding: '0 12px',
            height: 36,
            border: 'none',
            background: 'transparent',
            color: fgTertiary,
            fontSize: 16,
            cursor: 'pointer',
          }}
          aria-label="New tab"
        >
          +
        </button>
      </div>

      {/* ----------------------------------------------------------------
          Content area
      ---------------------------------------------------------------- */}
      {activeTable ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            overflow: 'hidden',
          }}
        >
          {/* Filter bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderBottom: `1px solid ${border}`,
              background: bgSurface,
              flexShrink: 0,
            }}
          >
            <span style={{ color: fgTertiary, fontSize: 14 }}>âŒ•</span>
            <input
              placeholder="Filter by id, name, email... or ask AI"
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 12,
                color: fgPrimary,
              }}
            />
          </div>

          {/* Action bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderBottom: `1px solid ${border}`,
              background: bgSurface,
              flexShrink: 0,
              flexWrap: 'wrap',
            }}
          >
            <ActionBtn>
              <span style={{ fontSize: 11 }}>â‡…</span> Sorted by 1 rule
            </ActionBtn>
            <ActionBtn danger>
              <span style={{ fontSize: 11 }}>â—</span> RLS disabled
            </ActionBtn>
            <ActionBtn warning>
              <span style={{ fontSize: 11 }}>âš¡</span> Index Advisor
            </ActionBtn>
            <ActionBtn>
              <span style={{ fontSize: 11 }}>âŸ³</span> Enable Realtime
            </ActionBtn>
            <ActionBtn>
              <span style={{ color: fgTertiary, fontSize: 11 }}>Role:</span>
              <strong style={{ marginLeft: 3, fontSize: 11 }}>postgres</strong>
              <span style={{ fontSize: 9, marginLeft: 3, color: fgTertiary }}>â–¼</span>
            </ActionBtn>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <ActionBtn title="Refresh">â†»</ActionBtn>
              <ActionBtn title="View options">â–¦</ActionBtn>
              <ActionBtn success>
                <span>+</span> Insert
              </ActionBtn>
            </div>
          </div>

          {/* Grid */}
          <div
            style={{
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              background: bgSurface,
            }}
          >
            <DataGrid tableName={activeTable} />
          </div>

          {/* Pagination */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '4px 12px',
              borderTop: `1px solid ${border}`,
              background: bgSurface,
              fontSize: 12,
              color: fgSecondary,
              flexShrink: 0,
            }}
          >
            <span>Page</span>
            <select
              style={{
                border: `1px solid ${border}`,
                borderRadius: 4,
                background: bgSurface,
                color: fgPrimary,
                fontSize: 12,
                padding: '1px 4px',
              }}
            >
              <option>1</option>
            </select>
            <span>of 1</span>
            <select
              style={{
                border: `1px solid ${border}`,
                borderRadius: 4,
                background: bgSurface,
                color: fgPrimary,
                fontSize: 12,
                padding: '1px 4px',
                width: 80,
              }}
            >
              <option>100 rows</option>
              <option>50 rows</option>
              <option>500 rows</option>
            </select>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {activeMeta?.rows.toLocaleString() ?? 0} records
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 1 }}>
              <button
                style={{
                  padding: '2px 10px',
                  fontSize: 11,
                  border: `1px solid ${border}`,
                  borderRadius: '4px 0 0 4px',
                  background: accentSubtle,
                  color: accentPrimary,
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Data
              </button>
              <button
                style={{
                  padding: '2px 10px',
                  fontSize: 11,
                  border: `1px solid ${border}`,
                  borderRadius: '0 4px 4px 0',
                  background: 'transparent',
                  color: fgSecondary,
                  cursor: 'pointer',
                }}
              >
                Definition
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty state when all tabs closed */
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: fgTertiary,
            fontSize: 13,
          }}
        >
          <span style={{ fontSize: 28, marginBottom: 8 }}>â–¦</span>
          <p>Open a table from the left panel to get started.</p>
        </div>
      )}

      <style>{`
        .te-row:hover td {
          background: var(--muted) !important;
        }
      `}</style>
    </div>
  );
}

export default function TableEditorPage() {
  return (
    <Suspense>
      <TableEditorInner />
    </Suspense>
  );
}

// ---------------------------------------------------------------------------
// ActionBtn helper
// ---------------------------------------------------------------------------

function ActionBtn({
  children,
  danger,
  warning,
  success,
  title,
}: {
  children: React.ReactNode;
  danger?: boolean;
  warning?: boolean;
  success?: boolean;
  title?: string;
}) {
  let bg = 'transparent';
  let color = 'var(--muted-foreground)';
  let border = '1px solid var(--border)';

  if (danger) {
    bg = 'oklch(0.96 0.04 25)';
    color = 'oklch(0.45 0.18 25)';
    border = '1px solid oklch(0.45 0.18 25 / 0.3)';
  } else if (warning) {
    bg = 'oklch(0.97 0.05 75)';
    color = 'oklch(0.45 0.14 75)';
    border = '1px solid oklch(0.45 0.14 75 / 0.3)';
  } else if (success) {
    bg = 'var(--primary)';
    color = 'var(--primary-foreground)';
    border = 'none';
  }

  return (
    <button
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        fontSize: 11,
        borderRadius: 4,
        border,
        background: bg,
        color,
        cursor: 'pointer',
        fontWeight: success ? 500 : 400,
        height: 26,
      }}
    >
      {children}
    </button>
  );
}
