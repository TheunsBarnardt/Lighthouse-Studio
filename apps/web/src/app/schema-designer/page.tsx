'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

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
  'Hero Â· Centered',
  'CTA Â· Band',
  'Features Â· Grid',
  'Table Â· Sortable',
  'Stats Â· Grid',
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
  background: active ? 'var(--primary)' : 'transparent',
  color: active ? '#fff' : 'var(--muted-foreground)',
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
  background: active ? 'var(--border)' : 'transparent',
  color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
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
          padding: '8px 16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 2,
            borderRadius: 6,
            border: '1px solid var(--border)',
            padding: 2,
          }}
        >
          <Button
            style={modeTabStyle(mode === 'schema')}
            onClick={() => {
              setMode('schema');
            }}
          >
            Schema
          </Button>
          <Button
            style={modeTabStyle(mode === 'pages')}
            onClick={() => {
              setMode('pages');
            }}
          >
            Pages
          </Button>
        </div>

        {mode === 'pages' && (
          <>
            <div style={{ display: 'flex', gap: 2 }}>
              {PAGES.map((p) => (
                <Button
                  key={p}
                  onClick={() => {
                    setActivePage(p);
                  }}
                  style={pageTabStyle(activePage === p)}
                >
                  <span style={{ fontSize: 10, opacity: 0.6 }}>â–¤</span>
                  {p}
                  {(p === 'dashboard' || p === 'deals') && (
                    <span
                      className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                      style={{ fontSize: 9, padding: '0 4px', lineHeight: '14px', height: 14 }}
                    >
                      auto
                    </span>
                  )}
                </Button>
              ))}
              <Button style={pageTabStyle(false)}>+</Button>
            </div>
            <div
              style={{
                marginLeft: 'auto',
                display: 'flex',
                gap: 2,
                borderRadius: 6,
                border: '1px solid var(--border)',
                padding: 2,
              }}
            >
              {(['desktop', 'tablet', 'mobile'] as const).map((v) => (
                <Button
                  key={v}
                  onClick={() => {
                    setViewport(v);
                  }}
                  style={modeTabStyle(viewport === v)}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </Button>
              ))}
            </div>
            <Button variant="ghost" size="sm" type="button" style={{ fontSize: 12 }}>
              Preview
            </Button>
            <Button variant="outline" size="sm" type="button" style={{ fontSize: 12 }}>
              Discard
            </Button>
            <Button size="sm" type="button" style={{ fontSize: 12 }}>
              Save &amp; Deploy
            </Button>
          </>
        )}

        {mode === 'schema' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <Button variant="outline" size="sm" type="button" style={{ fontSize: 12 }}>
              Open in Designer
            </Button>
            <Button size="sm" type="button" style={{ fontSize: 12 }}>
              Approve &amp; apply â†’
            </Button>
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
              background: 'color-mix(in srgb, var(--border) 30%, var(--background))',
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
                    border: `1px solid ${selectedTable === table.name ? 'var(--primary)' : 'var(--border)'}`,
                    boxShadow:
                      selectedTable === table.name
                        ? '0 0 0 2px var(--primary)'
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
                          ? 'var(--primary)'
                          : 'var(--border)',
                      color: selectedTable === table.name ? '#fff' : 'var(--foreground)',
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
                          '1px solid color-mix(in srgb, var(--border) 60%, transparent)',
                        padding: '4px 12px',
                      }}
                    >
                      <span style={{ fontSize: 12 }}>
                        {col.role === 'pk' && (
                          <span style={{ marginRight: 4, color: '#f59e0b' }}>ðŸ”‘</span>
                        )}
                        {col.role === 'fk' && <span style={{ marginRight: 4 }}>â›“</span>}
                        {col.name}
                      </span>
                      <span className="font-mono text-sm" style={{ fontSize: 10 }}>
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
              borderLeft: '1px solid var(--border)',
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
                      margin: 0,
                      marginBottom: 2,
                    }}
                  >
                    {selectedTable}
                  </h3>
                  <p style={{ fontSize: 12, margin: 0 }}>
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
                        border: '1px solid var(--border)',
                        background:
                          'color-mix(in srgb, var(--border) 30%, var(--background))',
                        padding: '4px 8px',
                        marginBottom: 6,
                      }}
                    >
                      <span className="font-mono text-sm" style={{ fontSize: 12 }}>
                        {col.name}
                      </span>
                      <span
                        className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                        style={{ fontSize: 9 }}
                      >
                        {col.type}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    style={{ flex: 1, fontSize: 12 }}
                  >
                    + Column
                  </Button>
                  <Button variant="ghost" size="sm" type="button" style={{ fontSize: 12 }}>
                    Delete table
                  </Button>
                </div>
              </>
            ) : (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <p style={{ fontSize: 24, opacity: 0.3, marginBottom: 8 }}>â—°</p>
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
              borderRight: '1px solid var(--border)',
            }}
          >
            <div style={{ padding: 12 }}>
              <input
                style={{
                  width: '100%',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  background: 'color-mix(in srgb, var(--border) 30%, var(--background))',
                  padding: '4px 8px',
                  fontSize: 12,
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
                      border: '1px dashed var(--border)',
                      padding: '6px 8px',
                      fontSize: 12,
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
                        background: 'var(--border)',
                        fontSize: 10,
                        fontWeight: 600,
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
              background: 'color-mix(in srgb, var(--border) 30%, var(--background))',
              display: 'flex',
              justifyContent: 'center',
              padding: 24,
            }}
          >
            <div
              style={{
                borderRadius: 8,
                border: '1px solid var(--border)',
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
                    background: 'var(--primary)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#fff',
                  }}
                >
                  A
                </div>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Acme CRM</span>
                <nav style={{ display: 'flex', gap: 16 }}>
                  {['Dashboard', 'Deals', 'Contacts'].map((nav) => (
                    <a
                      key={nav}
                      style={{
                        fontSize: 12,
                        color:
                          activePage === nav.toLowerCase()
                            ? 'var(--foreground)'
                            : 'var(--muted-foreground)',
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
                            border: '1px solid var(--border)',
                            padding: 12,
                          }}
                        >
                          <p
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              margin: 0,
                            }}
                          >
                            {stat}
                          </p>
                          <p
                            style={{
                              fontSize: 20,
                              fontWeight: 600,
                              margin: '4px 0 2px',
                            }}
                          >
                            {['87', '$387k', '42', '17d'][i]}
                          </p>
                          <p style={{ fontSize: 12, margin: 0 }}>
                            {['+12%', '+$24k', '+18%', '-3d'][i]}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        padding: 16,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
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
                            }}
                          >
                            <span>{t}</span>
                            <span>{s}</span>
                            <span className="tabular-nums">{a}</span>
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
                      border: '1px solid var(--border)',
                      padding: 16,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        marginBottom: 8,
                        marginTop: 0,
                      }}
                    >
                      All Deals
                    </p>
                    <p style={{ fontSize: 12, margin: 0 }}>Deal list would render here.</p>
                  </div>
                )}
                {activePage === 'landing' && (
                  <div style={{ padding: '48px 0', textAlign: 'center' }}>
                    <p
                      style={{
                        fontSize: 22,
                        fontWeight: 700,
                        marginBottom: 8,
                      }}
                    >
                      Sales pipeline you can trust
                    </p>
                    <p style={{ fontSize: 13, marginBottom: 16 }}>
                      Built on Acme platform Â· self-hosted Â· GDPR-compliant.
                    </p>
                    <Button type="button">Sign in</Button>
                  </div>
                )}
                {activePage === 'sign-in' && (
                  <div
                    style={{
                      maxWidth: 360,
                      margin: '0 auto',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      padding: 24,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
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
                        border: '1px solid var(--border)',
                        padding: '8px 12px',
                        fontSize: 13,
                        marginBottom: 12,
                        boxSizing: 'border-box',
                      }}
                      placeholder="Email"
                    />
                    <input
                      style={{
                        width: '100%',
                        borderRadius: 4,
                        border: '1px solid var(--border)',
                        padding: '8px 12px',
                        fontSize: 13,
                        marginBottom: 16,
                        boxSizing: 'border-box',
                      }}
                      type="password"
                      placeholder="Password"
                    />
                    <Button type="button" style={{ width: '100%' }}>
                      Sign in
                    </Button>
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
              borderLeft: '1px solid var(--border)',
              padding: 16,
            }}
          >
            <p
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 12,
                marginTop: 0,
              }}
            >
              Page inspector
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
                <span className="text-muted-foreground">Page</span>
                <span className="font-medium">{activePage}</span>
              </div>
              <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
                <span className="text-muted-foreground">Source</span>
                <span className="font-medium">
                  {activePage === 'dashboard' || activePage === 'deals' ? 'AI Pipeline' : 'Manual'}
                </span>
              </div>
              <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
                <span className="text-muted-foreground">Last edited</span>
                <span className="font-medium">12 min ago</span>
              </div>
            </div>
            <hr
              style={{
                border: 'none',
                margin: '16px 0',
              }}
            />
            <p
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
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
                border: '1px solid var(--border)',
                padding: '6px 8px',
                fontSize: 13,
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
