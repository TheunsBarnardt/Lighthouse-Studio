const QUICK_START_TS = `import { createClient } from '@acme/platform-js';

const platform = createClient({
  url: 'https://api.acme.platform.local',
  apiKey: process.env.PLATFORM_API_KEY
});

// List deals — type-safe, filter inferred from schema
const { data: deals, error } = await platform
  .from('deals')
  .select('id, title, amount, owner(name)')
  .eq('stage', 'NEGOTIATION')
  .order('updated_at', { ascending: false })
  .limit(10);

if (error) throw error;
console.log(deals);  // typed as Deal[]`;

const SUBSCRIBE_CODE = `// Subscribe to deal updates in realtime
const channel = platform
  .channel('deals')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'deals',
    filter: 'stage=eq.WON'
  }, (payload) => {
    console.log('Deal won:', payload.new);
  })
  .subscribe();`;

const FUNCTION_CODE = `// Server functions are typed end-to-end
const { data, error } = await platform.functions.invoke('exportDealsCSV', {
  body: { stage: 'WON', from: '2026-01-01' }
});

// Returns: { url: string, expiresAt: string }
window.open(data.url);`;

const codeBlockStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, monospace',
  fontSize: 12,
  lineHeight: 1.6,
  background: 'var(--bg-canvas)',
  border: '1px solid var(--border-default)',
  borderRadius: 4,
  padding: '12px',
  color: 'var(--fg-primary)',
  margin: 0,
  overflowX: 'auto',
  whiteSpace: 'pre',
};

export default function SdkPage() {
  return (
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Client SDKs
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            Type-safe client libraries auto-generated from your schema · Updated when schema changes
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Changelog</button>
          <button className="pg-btn pg-btn-primary pg-btn-sm">Regenerate</button>
        </div>
      </div>

      <div className="pg-grid pg-grid-4" style={{ marginBottom: 16 }}>
        <div className="pg-card">
          <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--fg-primary)' }}>
            JavaScript / TypeScript
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-tertiary)', marginBottom: 8 }}>
            @acme/platform-js · v0.1.3
          </div>
          <pre style={{ ...codeBlockStyle, fontSize: 11 }}>npm i @acme/platform-js</pre>
        </div>
        <div className="pg-card">
          <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--fg-primary)' }}>Python</div>
          <div style={{ fontSize: 12, color: 'var(--fg-tertiary)', marginBottom: 8 }}>
            acme-platform · v0.1.3
          </div>
          <pre style={{ ...codeBlockStyle, fontSize: 11 }}>pip install acme-platform</pre>
        </div>
        <div className="pg-card">
          <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--fg-primary)' }}>Go</div>
          <div style={{ fontSize: 12, color: 'var(--fg-tertiary)', marginBottom: 8 }}>
            github.com/acme/platform-go
          </div>
          <pre style={{ ...codeBlockStyle, fontSize: 11 }}>go get github.com/acme/platform-go</pre>
        </div>
        <div className="pg-card">
          <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--fg-primary)' }}>cURL</div>
          <div style={{ fontSize: 12, color: 'var(--fg-tertiary)', marginBottom: 8 }}>
            No SDK needed
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
            REST endpoints work with any HTTP client
          </div>
        </div>
      </div>

      <div className="pg-card" style={{ marginBottom: 16 }}>
        <div className="pg-card-header">
          <div className="pg-card-title">Quick start</div>
        </div>
        <div style={{ display: 'flex', gap: 0, marginBottom: 12 }}>
          {['TypeScript', 'Python', 'Go', 'cURL'].map((tab, i) => (
            <button
              key={tab}
              className="pg-btn pg-btn-ghost pg-btn-xs"
              style={{
                background: i === 0 ? 'var(--accent-primary)' : 'transparent',
                color: i === 0 ? '#fff' : 'var(--fg-secondary)',
                borderRadius: 3,
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        <pre style={codeBlockStyle}>{QUICK_START_TS}</pre>
      </div>

      <div className="pg-card" style={{ marginBottom: 16 }}>
        <div className="pg-card-header">
          <div className="pg-card-title">Subscribe to changes</div>
        </div>
        <pre style={codeBlockStyle}>{SUBSCRIBE_CODE}</pre>
      </div>

      <div className="pg-card">
        <div className="pg-card-header">
          <div className="pg-card-title">Call a server function</div>
        </div>
        <pre style={codeBlockStyle}>{FUNCTION_CODE}</pre>
      </div>
    </div>
  );
}
