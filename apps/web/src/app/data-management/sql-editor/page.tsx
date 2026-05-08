'use client';

import { useState } from 'react';

interface SavedQuery {
  id: string;
  name: string;
  scope: 'private' | 'shared' | 'community';
}

const SAVED_QUERIES: SavedQuery[] = [
  { id: 'q1', name: 'Pipeline value by contact', scope: 'private' },
  { id: 'q2', name: 'Stale deals query', scope: 'private' },
  { id: 'q3', name: 'Daily revenue report', scope: 'shared' },
];

const INITIAL_SQL = `-- Pipeline value by contact, ordered by total
-- Filters to active stages only

SELECT
  c.name,
  c.company,
  COUNT(d.id) AS deal_count,
  SUM(d.amount) AS pipeline_value,
  MAX(d.created_at) AS latest_deal
FROM contacts c
LEFT JOIN deals d ON d.contact_id = c.id
WHERE d.stage IN ('qualified', 'proposal', 'negotiation')
  AND c.created_at >= NOW() - INTERVAL '90 days'
GROUP BY c.id, c.name, c.company
HAVING SUM(d.amount) > 10000
ORDER BY pipeline_value DESC
LIMIT 20;`;

const MOCK_RESULTS = [
  {
    name: 'Alice Schwartz',
    company: 'Beta Co',
    deal_count: 3,
    pipeline_value: '$124,000',
    latest_deal: '2026-05-06',
  },
  {
    name: 'Carlos Ruiz',
    company: 'Globex',
    deal_count: 2,
    pipeline_value: '$89,500',
    latest_deal: '2026-05-04',
  },
  {
    name: 'Yuki Tanaka',
    company: 'Initech',
    deal_count: 4,
    pipeline_value: '$76,200',
    latest_deal: '2026-05-07',
  },
  {
    name: 'Priya Patel',
    company: 'Acme Corp',
    deal_count: 1,
    pipeline_value: '$48,000',
    latest_deal: '2026-05-02',
  },
];

// CSS var aliases
const border = 'var(--border-default)';
const bgSurface = 'var(--bg-surface)';
const bgCanvas = 'var(--bg-canvas)';
const bgSurface3 = 'var(--bg-surface-3)';
const fgPrimary = 'var(--fg-primary)';
const fgSecondary = 'var(--fg-secondary)';
const fgTertiary = 'var(--fg-tertiary)';
const accentPrimary = 'var(--accent-primary)';
const accentSubtle = 'var(--accent-primary-subtle)';

export default function SqlEditorPage() {
  const [activeQuery, setActiveQuery] = useState<string>('q1');
  const [openQueryIds] = useState<string[]>(['q1', 'q2']);
  const [sql, setSql] = useState(INITIAL_SQL);
  const [results, setResults] = useState<typeof MOCK_RESULTS | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [runTime, setRunTime] = useState<string | null>(null);
  const [resultsTab, setResultsTab] = useState<'Results' | 'Chart'>('Results');

  function handleRun() {
    setIsRunning(true);
    setTimeout(() => {
      setResults(MOCK_RESULTS);
      setRunTime('47ms');
      setIsRunning(false);
    }, 600);
  }

  const openQueries = SAVED_QUERIES.filter((q) => openQueryIds.includes(q.id));

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
        background: bgCanvas,
        fontSize: 13,
        color: fgPrimary,
      }}
    >
      {/* ----------------------------------------------------------------
          Left context panel (query list)
      ---------------------------------------------------------------- */}
      <div
        style={{
          width: 220,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: `1px solid ${border}`,
          background: bgSurface,
        }}
      >
        {/* Search */}
        <div style={{ padding: '8px', borderBottom: `1px solid ${border}` }}>
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: 7,
                top: '50%',
                transform: 'translateY(-50%)',
                color: fgTertiary,
                fontSize: 13,
                pointerEvents: 'none',
              }}
            >
              ⌕
            </span>
            <input
              placeholder="Search queries..."
              style={{
                width: '100%',
                paddingLeft: 24,
                paddingRight: 8,
                paddingTop: 4,
                paddingBottom: 4,
                border: `1px solid ${border}`,
                borderRadius: 4,
                background: bgCanvas,
                color: fgPrimary,
                fontSize: 12,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* New query button */}
        <div style={{ padding: '6px 8px', borderBottom: `1px solid ${border}` }}>
          <button
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 8px',
              fontSize: 12,
              border: `1px solid ${border}`,
              borderRadius: 4,
              background: bgCanvas,
              color: fgSecondary,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
            <span>New query</span>
          </button>
        </div>

        {/* Query list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
          {(['private', 'shared'] as const).map((scope) => {
            const scopeQueries = SAVED_QUERIES.filter((q) => q.scope === scope);
            if (scopeQueries.length === 0) return null;
            return (
              <div key={scope} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: fgTertiary,
                    padding: '4px 6px 2px',
                  }}
                >
                  {scope === 'private' ? `Private (${String(scopeQueries.length)})` : 'Shared'}
                </div>
                {scopeQueries.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => {
                      setActiveQuery(q.id);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 6px',
                      borderRadius: 4,
                      border: 'none',
                      background: activeQuery === q.id ? accentSubtle : 'transparent',
                      color: activeQuery === q.id ? accentPrimary : fgSecondary,
                      cursor: 'pointer',
                      fontSize: 12,
                      textAlign: 'left',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        padding: '1px 4px',
                        borderRadius: 3,
                        background: accentSubtle,
                        color: accentPrimary,
                        flexShrink: 0,
                      }}
                    >
                      SQL
                    </span>
                    <span
                      style={{
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {q.name}
                    </span>
                  </button>
                ))}
              </div>
            );
          })}

          {/* Community section */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: fgTertiary,
                padding: '4px 6px 2px',
              }}
            >
              Community
            </div>
            {['Templates', 'Quickstarts'].map((label) => (
              <button
                key={label}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 6px',
                  borderRadius: 4,
                  border: 'none',
                  background: 'transparent',
                  color: fgSecondary,
                  cursor: 'pointer',
                  fontSize: 12,
                  textAlign: 'left',
                }}
              >
                <span>{label === 'Templates' ? '▤' : '⚡'}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '8px', borderTop: `1px solid ${border}` }}>
          <button
            style={{
              width: '100%',
              padding: '4px 8px',
              fontSize: 12,
              border: `1px solid ${border}`,
              borderRadius: 4,
              background: bgCanvas,
              color: fgSecondary,
              cursor: 'pointer',
            }}
          >
            View running queries
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------
          Main editor area
      ---------------------------------------------------------------- */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Tab row */}
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
          {openQueries.map((q) => {
            const isActive = q.id === activeQuery;
            return (
              <button
                key={q.id}
                onClick={() => {
                  setActiveQuery(q.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '0 12px',
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
                <span style={{ fontSize: 11, color: fgTertiary }}>▶</span>
                <span>{q.name}</span>
                <span style={{ marginLeft: 2, color: fgTertiary, fontSize: 11, padding: '0 2px' }}>
                  ✕
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
          >
            +
          </button>
        </div>

        {/* SQL editor */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 12,
            background: bgCanvas,
          }}
        >
          <textarea
            value={sql}
            onChange={(e) => {
              setSql(e.target.value);
            }}
            spellCheck={false}
            style={{
              width: '100%',
              height: '100%',
              minHeight: 160,
              resize: 'none',
              border: `1px solid ${border}`,
              borderRadius: 6,
              background: bgSurface,
              color: fgPrimary,
              fontFamily: 'var(--font-geist-mono, monospace)',
              fontSize: 12,
              lineHeight: 1.7,
              padding: '12px 14px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Results panel */}
        <div
          style={{
            height: 280,
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderTop: `1px solid ${border}`,
            background: bgSurface,
          }}
        >
          {/* Results header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              height: 36,
              borderBottom: `1px solid ${border}`,
              background: bgSurface3,
              gap: 12,
              flexShrink: 0,
            }}
          >
            {(['Results', 'Chart'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setResultsTab(tab);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: resultsTab === tab ? 500 : 400,
                  color: resultsTab === tab ? fgPrimary : fgTertiary,
                  padding: '0 0 2px',
                  borderBottom:
                    resultsTab === tab ? `2px solid ${accentPrimary}` : '2px solid transparent',
                  height: '100%',
                }}
              >
                {tab}
              </button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: fgSecondary }}>
                Role: <strong>postgres</strong>
              </span>
              {runTime && results && (
                <span style={{ fontSize: 12, color: fgTertiary }}>
                  {results.length} rows · {runTime}
                </span>
              )}
              <button
                onClick={handleRun}
                disabled={isRunning}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 12px',
                  fontSize: 12,
                  fontWeight: 500,
                  border: 'none',
                  borderRadius: 4,
                  background: isRunning ? 'var(--fg-disabled)' : accentPrimary,
                  color: 'var(--accent-primary-fg)',
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                }}
              >
                {isRunning ? 'Running…' : 'Run'}
                <kbd
                  style={{
                    background: 'oklch(0 0 0 / 0.2)',
                    border: 'none',
                    borderRadius: 3,
                    padding: '1px 4px',
                    fontSize: 10,
                    color: 'oklch(1 0 0 / 0.8)',
                    fontFamily: 'inherit',
                  }}
                >
                  Ctrl ↵
                </kbd>
              </button>
            </div>
          </div>

          {/* Results content */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {results === null ? (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  color: fgTertiary,
                }}
              >
                Click <strong style={{ color: fgPrimary, margin: '0 4px' }}>Run</strong> to execute
                your query.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: bgSurface3, position: 'sticky', top: 0 }}>
                    {Object.keys(results[0] ?? {}).map((col) => (
                      <th
                        key={col}
                        style={{
                          padding: '6px 12px',
                          textAlign: 'left',
                          fontWeight: 500,
                          color: fgSecondary,
                          borderBottom: `1px solid ${border}`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${border}` }}>
                      {Object.values(row).map((val, j) => (
                        <td
                          key={j}
                          style={{
                            padding: '5px 12px',
                            fontFamily: 'var(--font-geist-mono, monospace)',
                            color: fgPrimary,
                          }}
                        >
                          {String(val)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
