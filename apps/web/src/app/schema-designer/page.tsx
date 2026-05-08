'use client';

import { useState } from 'react';

interface Column {
  name: string;
  type: string;
  role: 'pk' | 'fk' | '';
}

interface SchemaTable {
  name: string;
  x: number;
  y: number;
  columns: Column[];
}

const TABLES: SchemaTable[] = [
  {
    name: 'contacts',
    x: 40,
    y: 40,
    columns: [
      { name: 'id', type: 'UUID', role: 'pk' },
      { name: 'email', type: 'TEXT', role: '' },
      { name: 'name', type: 'TEXT', role: '' },
      { name: 'phone', type: 'TEXT', role: '' },
      { name: 'company', type: 'TEXT', role: '' },
      { name: 'notes', type: 'TEXT', role: '' },
    ],
  },
  {
    name: 'deals',
    x: 320,
    y: 40,
    columns: [
      { name: 'id', type: 'UUID', role: 'pk' },
      { name: 'contact_id', type: 'UUID', role: 'fk' },
      { name: 'title', type: 'TEXT', role: '' },
      { name: 'stage', type: 'ENUM', role: '' },
      { name: 'amount', type: 'MONEY', role: '' },
      { name: 'owner_id', type: 'UUID', role: 'fk' },
    ],
  },
  {
    name: 'activities',
    x: 600,
    y: 40,
    columns: [
      { name: 'id', type: 'UUID', role: 'pk' },
      { name: 'deal_id', type: 'UUID', role: 'fk' },
      { name: 'type', type: 'ENUM', role: '' },
      { name: 'summary', type: 'TEXT', role: '' },
      { name: 'occurred_at', type: 'TIMESTAMP', role: '' },
    ],
  },
  {
    name: 'users',
    x: 40,
    y: 320,
    columns: [
      { name: 'id', type: 'UUID', role: 'pk' },
      { name: 'email', type: 'TEXT', role: '' },
      { name: 'display_name', type: 'TEXT', role: '' },
      { name: 'role', type: 'ENUM', role: '' },
    ],
  },
  {
    name: 'tags',
    x: 320,
    y: 320,
    columns: [
      { name: 'id', type: 'UUID', role: 'pk' },
      { name: 'name', type: 'TEXT', role: '' },
      { name: 'color', type: 'TEXT', role: '' },
    ],
  },
  {
    name: 'contact_tags',
    x: 600,
    y: 320,
    columns: [
      { name: 'contact_id', type: 'UUID', role: 'fk' },
      { name: 'tag_id', type: 'UUID', role: 'fk' },
    ],
  },
];

const PAGES = ['dashboard', 'deals', 'landing', 'sign-in'] as const;
type PageId = (typeof PAGES)[number];

const BLOCKS = [
  'Hero · Centered',
  'CTA · Band',
  'Features · Grid',
  'Table · Sortable',
  'Stats · Grid',
  'YouTube embed',
  'Stripe checkout',
  'AI Chat widget',
];

type DesignerMode = 'schema' | 'pages';

const modeTabStyle = (active: boolean): React.CSSProperties => ({
  padding: '4px 12px',
  borderRadius: 4,
  fontSize: 12,
  fontWeight: 500,
  background: active ? 'var(--accent-primary)' : 'transparent',
  color: active ? '#fff' : 'var(--fg-secondary)',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.15s',
});

const pageTabStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  borderRadius: 4,
  fontSize: 12,
  background: active ? 'var(--border-default)' : 'transparent',
  color: active ? 'var(--fg-primary)' : 'var(--fg-secondary)',
  fontWeight: active ? 500 : 400,
  border: 'none',
  cursor: 'pointer',
});

export default function SchemaDesignerPage() {
  const [mode, setMode] = useState<DesignerMode>('schema');
  const [selectedTable, setSelectedTable] = useState<string | null>('contacts');
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  return (
    <div style={{ display: 'flex', height: '100%', flexDirection: 'column' }}>
      {/* Top toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          borderBottom: '1px solid var(--border-default)',
          background: 'var(--bg-canvas)',
          padding: '8px 16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 2,
            borderRadius: 6,
            border: '1px solid var(--border-default)',
            padding: 2,
          }}
        >
          <button
            style={modeTabStyle(mode === 'schema')}
            onClick={() => {
              setMode('schema');
            }}
          >
            Schema
          </button>
          <button
            style={modeTabStyle(mode === 'pages')}
            onClick={() => {
              setMode('pages');
            }}
          >
            Pages
          </button>
        </div>

        {mode === 'pages' && (
          <>
            <div style={{ display: 'flex', gap: 2 }}>
              {PAGES.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setActivePage(p);
                  }}
                  style={pageTabStyle(activePage === p)}
                >
                  <span style={{ fontSize: 10, opacity: 0.6 }}>▤</span>
                  {p}
                  {(p === 'dashboard' || p === 'deals') && (
                    <span
                      className="pg-badge pg-badge-default"
                      style={{ fontSize: 9, padding: '0 4px', lineHeight: '14px', height: 14 }}
                    >
                      auto
                    </span>
                  )}
                </button>
              ))}
              <button style={pageTabStyle(false)}>+</button>
            </div>
            <div
              style={{
                marginLeft: 'auto',
                display: 'flex',
                gap: 2,
                borderRadius: 6,
                border: '1px solid var(--border-default)',
                padding: 2,
              }}
            >
              {(['desktop', 'tablet', 'mobile'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setViewport(v);
                  }}
                  style={modeTabStyle(viewport === v)}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
            <button className="pg-btn pg-btn-ghost pg-btn-sm" style={{ fontSize: 12 }}>
              Preview
            </button>
            <button className="pg-btn pg-btn-secondary pg-btn-sm" style={{ fontSize: 12 }}>
              Discard
            </button>
            <button className="pg-btn pg-btn-primary pg-btn-sm" style={{ fontSize: 12 }}>
              Save &amp; Deploy
            </button>
          </>
        )}

        {mode === 'schema' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="pg-btn pg-btn-secondary pg-btn-sm" style={{ fontSize: 12 }}>
              Open in Designer
            </button>
            <button className="pg-btn pg-btn-primary pg-btn-sm" style={{ fontSize: 12 }}>
              Approve &amp; apply →
            </button>
          </div>
        )}
      </div>

      {mode === 'schema' ? (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Schema canvas */}
          <div
            style={{
              position: 'relative',
              flex: 1,
              overflow: 'auto',
              background: 'color-mix(in srgb, var(--border-default) 30%, var(--bg-canvas))',
              minHeight: 500,
            }}
          >
            <div style={{ position: 'relative', width: 900, height: 560, margin: 16 }}>
              {TABLES.map((table) => (
                <div
                  key={table.name}
                  onClick={() => {
                    setSelectedTable(table.name);
                  }}
                  style={{
                    position: 'absolute',
                    left: table.x,
                    top: table.y,
                    width: 220,
                    cursor: 'pointer',
                    borderRadius: 6,
                    border: `1px solid ${selectedTable === table.name ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                    background: 'var(--bg-canvas)',
                    boxShadow:
                      selectedTable === table.name
                        ? '0 0 0 2px var(--accent-primary)'
                        : '0 1px 3px rgba(0,0,0,0.08)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      background:
                        selectedTable === table.name
                          ? 'var(--accent-primary)'
                          : 'var(--border-default)',
                      color: selectedTable === table.name ? '#fff' : 'var(--fg-primary)',
                    }}
                  >
                    {table.name}
                  </div>
                  {table.columns.map((col) => (
                    <div
                      key={col.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderTop:
                          '1px solid color-mix(in srgb, var(--border-default) 60%, transparent)',
                        padding: '4px 12px',
                      }}
                    >
                      <span style={{ fontSize: 12, color: 'var(--fg-primary)' }}>
                        {col.role === 'pk' && (
                          <span style={{ marginRight: 4, color: '#f59e0b' }}>🔑</span>
                        )}
                        {col.role === 'fk' && (
                          <span style={{ marginRight: 4, color: 'var(--accent-primary)' }}>⛓</span>
                        )}
                        {col.name}
                      </span>
                      <span
                        className="pg-mono"
                        style={{ fontSize: 10, color: 'var(--fg-tertiary)' }}
                      >
                        {col.type}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Right inspector */}
          <div
            style={{
              width: 288,
              flexShrink: 0,
              overflowY: 'auto',
              borderLeft: '1px solid var(--border-default)',
              background: 'var(--bg-canvas)',
              padding: 16,
            }}
          >
            {selectedTable ? (
              <>
                <div style={{ marginBottom: 16 }}>
                  <h3
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--fg-primary)',
                      margin: 0,
                      marginBottom: 2,
                    }}
                  >
                    {selectedTable}
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--fg-tertiary)', margin: 0 }}>
                    {TABLES.find((t) => t.name === selectedTable)?.columns.length} columns
                  </p>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <p
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: 'var(--fg-tertiary)',
                      marginBottom: 8,
                      marginTop: 0,
                    }}
                  >
                    Columns
                  </p>
                  {TABLES.find((t) => t.name === selectedTable)?.columns.map((col) => (
                    <div
                      key={col.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderRadius: 4,
                        border: '1px solid var(--border-default)',
                        background:
                          'color-mix(in srgb, var(--border-default) 30%, var(--bg-canvas))',
                        padding: '4px 8px',
                        marginBottom: 6,
                      }}
                    >
                      <span
                        className="pg-mono"
                        style={{ fontSize: 12, color: 'var(--fg-primary)' }}
                      >
                        {col.name}
                      </span>
                      <span className="pg-badge pg-badge-default" style={{ fontSize: 9 }}>
                        {col.type}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="pg-btn pg-btn-secondary pg-btn-sm"
                    style={{ flex: 1, fontSize: 12 }}
                  >
                    + Column
                  </button>
                  <button
                    className="pg-btn pg-btn-ghost pg-btn-sm"
                    style={{ fontSize: 12, color: 'var(--fg-danger)' }}
                  >
                    Delete table
                  </button>
                </div>
              </>
            ) : (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--fg-tertiary)' }}>
                <p style={{ fontSize: 24, opacity: 0.3, marginBottom: 8 }}>◰</p>
                <p style={{ fontSize: 13, margin: 0 }}>Select a table to edit</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Pages designer */
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Block rail */}
          <div
            style={{
              width: 224,
              flexShrink: 0,
              overflowY: 'auto',
              borderRight: '1px solid var(--border-default)',
              background: 'var(--bg-canvas)',
            }}
          >
            <div style={{ padding: 12 }}>
              <input
                style={{
                  width: '100%',
                  borderRadius: 4,
                  border: '1px solid var(--border-default)',
                  background: 'color-mix(in srgb, var(--border-default) 30%, var(--bg-canvas))',
                  padding: '4px 8px',
                  fontSize: 12,
                  color: 'var(--fg-primary)',
                  marginBottom: 12,
                  boxSizing: 'border-box',
                }}
                placeholder="Search blocks..."
              />
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--fg-tertiary)',
                  marginBottom: 8,
                  marginTop: 0,
                }}
              >
                Blocks
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {BLOCKS.map((block) => (
                  <div
                    key={block}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'grab',
                      borderRadius: 4,
                      border: '1px dashed var(--border-default)',
                      background: 'var(--bg-canvas)',
                      padding: '6px 8px',
                      fontSize: 12,
                      color: 'var(--fg-primary)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        width: 24,
                        height: 24,
                        flexShrink: 0,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 4,
                        background: 'var(--border-default)',
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'var(--accent-primary)',
                      }}
                    >
                      {block.charAt(0)}
                    </div>
                    <span>{block}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              background: 'color-mix(in srgb, var(--border-default) 30%, var(--bg-canvas))',
              display: 'flex',
              justifyContent: 'center',
              padding: 24,
            }}
          >
            <div
              style={{
                borderRadius: 8,
                border: '1px solid var(--border-default)',
                background: 'var(--bg-canvas)',
                boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
                width: viewport === 'desktop' ? 1024 : viewport === 'tablet' ? 768 : 375,
                minHeight: 600,
                flexShrink: 0,
              }}
            >
              {/* Simulated app chrome */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  borderBottom: '1px solid var(--border-default)',
                  padding: '12px 24px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    width: 24,
                    height: 24,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 4,
                    background: 'var(--accent-primary)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#fff',
                  }}
                >
                  A
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-primary)' }}>
                  Acme CRM
                </span>
                <nav style={{ display: 'flex', gap: 16 }}>
                  {['Dashboard', 'Deals', 'Contacts'].map((nav) => (
                    <a
                      key={nav}
                      style={{
                        fontSize: 12,
                        color:
                          activePage === nav.toLowerCase()
                            ? 'var(--fg-primary)'
                            : 'var(--fg-tertiary)',
                        fontWeight: activePage === nav.toLowerCase() ? 600 : 400,
                      }}
                    >
                      {nav}
                    </a>
                  ))}
                </nav>
              </div>

              {/* Page content placeholder */}
              <div style={{ padding: 24 }}>
                {activePage === 'dashboard' && (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: 12,
                        marginBottom: 16,
                      }}
                    >
                      {['Active deals', 'Pipeline', 'Won this Q', 'Avg close'].map((stat, i) => (
                        <div
                          key={stat}
                          style={{
                            borderRadius: 8,
                            border: '1px solid var(--border-default)',
                            padding: 12,
                          }}
                        >
                          <p
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              color: 'var(--fg-tertiary)',
                              margin: 0,
                            }}
                          >
                            {stat}
                          </p>
                          <p
                            style={{
                              fontSize: 20,
                              fontWeight: 600,
                              color: 'var(--fg-primary)',
                              margin: '4px 0 2px',
                            }}
                          >
                            {['87', '$387k', '42', '17d'][i]}
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--fg-success)', margin: 0 }}>
                            {['+12%', '+$24k', '+18%', '-3d'][i]}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        borderRadius: 8,
                        border: '1px solid var(--border-default)',
                        padding: 16,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--fg-primary)',
                          marginBottom: 8,
                          marginTop: 0,
                        }}
                      >
                        Deals
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                          ['Acme renewal', 'Negotiation', '$124k'],
                          ['Beta expansion', 'Proposal', '$48k'],
                          ['Gamma deal', 'Won', '$220k'],
                        ].map(([t, s, a]) => (
                          <div
                            key={t}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: 12,
                              color: 'var(--fg-primary)',
                            }}
                          >
                            <span>{t}</span>
                            <span style={{ color: 'var(--fg-tertiary)' }}>{s}</span>
                            <span className="pg-tabular">{a}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {activePage === 'deals' && (
                  <div
                    style={{
                      borderRadius: 8,
                      border: '1px solid var(--border-default)',
                      padding: 16,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--fg-primary)',
                        marginBottom: 8,
                        marginTop: 0,
                      }}
                    >
                      All Deals
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--fg-tertiary)', margin: 0 }}>
                      Deal list would render here.
                    </p>
                  </div>
                )}
                {activePage === 'landing' && (
                  <div style={{ padding: '48px 0', textAlign: 'center' }}>
                    <p
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        color: 'var(--fg-primary)',
                        marginBottom: 8,
                      }}
                    >
                      Sales pipeline you can trust
                    </p>
                    <p style={{ fontSize: 13, color: 'var(--fg-secondary)', marginBottom: 16 }}>
                      Built on Acme platform · self-hosted · GDPR-compliant.
                    </p>
                    <button className="pg-btn pg-btn-primary">Sign in</button>
                  </div>
                )}
                {activePage === 'sign-in' && (
                  <div
                    style={{
                      maxWidth: 360,
                      margin: '0 auto',
                      borderRadius: 8,
                      border: '1px solid var(--border-default)',
                      padding: 24,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: 'var(--fg-primary)',
                        textAlign: 'center',
                        marginBottom: 16,
                      }}
                    >
                      Sign in to Acme CRM
                    </p>
                    <input
                      style={{
                        width: '100%',
                        borderRadius: 4,
                        border: '1px solid var(--border-default)',
                        padding: '8px 12px',
                        fontSize: 13,
                        color: 'var(--fg-primary)',
                        background: 'var(--bg-canvas)',
                        marginBottom: 12,
                        boxSizing: 'border-box',
                      }}
                      placeholder="Email"
                    />
                    <input
                      style={{
                        width: '100%',
                        borderRadius: 4,
                        border: '1px solid var(--border-default)',
                        padding: '8px 12px',
                        fontSize: 13,
                        color: 'var(--fg-primary)',
                        background: 'var(--bg-canvas)',
                        marginBottom: 16,
                        boxSizing: 'border-box',
                      }}
                      type="password"
                      placeholder="Password"
                    />
                    <button className="pg-btn pg-btn-primary" style={{ width: '100%' }}>
                      Sign in
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Inspector */}
          <div
            style={{
              width: 256,
              flexShrink: 0,
              overflowY: 'auto',
              borderLeft: '1px solid var(--border-default)',
              background: 'var(--bg-canvas)',
              padding: 16,
            }}
          >
            <p
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--fg-tertiary)',
                marginBottom: 12,
                marginTop: 0,
              }}
            >
              Page inspector
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="pg-inspector-row">
                <span className="pg-inspector-key">Page</span>
                <span className="pg-inspector-val">{activePage}</span>
              </div>
              <div className="pg-inspector-row">
                <span className="pg-inspector-key">Source</span>
                <span className="pg-inspector-val">
                  {activePage === 'dashboard' || activePage === 'deals' ? 'AI Pipeline' : 'Manual'}
                </span>
              </div>
              <div className="pg-inspector-row">
                <span className="pg-inspector-key">Last edited</span>
                <span className="pg-inspector-val" style={{ color: 'var(--fg-tertiary)' }}>
                  12 min ago
                </span>
              </div>
            </div>
            <hr
              style={{
                border: 'none',
                borderTop: '1px solid var(--border-default)',
                margin: '16px 0',
              }}
            />
            <p
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--fg-tertiary)',
                marginBottom: 8,
                marginTop: 0,
              }}
            >
              Chrome override
            </p>
            <select
              style={{
                width: '100%',
                borderRadius: 4,
                border: '1px solid var(--border-default)',
                background: 'var(--bg-canvas)',
                padding: '6px 8px',
                fontSize: 13,
                color: 'var(--fg-primary)',
              }}
            >
              <option>App Chrome default</option>
              <option>No chrome (full page)</option>
              <option>Custom...</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
