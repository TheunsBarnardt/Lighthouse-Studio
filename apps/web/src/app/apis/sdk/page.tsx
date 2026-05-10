import { Button } from '@/components/ui/button';

const QUICK_START_TS = `import { createClient } from '@acme/platform-js';

const platform = createClient({
  url: 'https://api.acme.platform.local',
  apiKey: process.env.PLATFORM_API_KEY
});

// List deals â€” type-safe, filter inferred from schema
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
  border: '1px solid var(--border)',
  borderRadius: 4,
  padding: '12px',
  margin: 0,
  overflowX: 'auto',
  whiteSpace: 'pre',
};

export default function SdkPage() {
  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Client SDKs</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Type-safe client libraries auto-generated from your schema Â· Updated when schema changes
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" type="button">
            Changelog
          </Button>
          <Button size="sm" type="button">
            Regenerate
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 16 }}>
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div style={{ fontWeight: 600, marginBottom: 4 }}>JavaScript / TypeScript</div>
          <div style={{ fontSize: 12, marginBottom: 8 }}>@acme/platform-js Â· v0.1.3</div>
          <pre style={{ ...codeBlockStyle, fontSize: 11 }}>npm i @acme/platform-js</pre>
        </div>
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Python</div>
          <div style={{ fontSize: 12, marginBottom: 8 }}>acme-platform Â· v0.1.3</div>
          <pre style={{ ...codeBlockStyle, fontSize: 11 }}>pip install acme-platform</pre>
        </div>
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Go</div>
          <div style={{ fontSize: 12, marginBottom: 8 }}>github.com/acme/platform-go</div>
          <pre style={{ ...codeBlockStyle, fontSize: 11 }}>go get github.com/acme/platform-go</pre>
        </div>
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div style={{ fontWeight: 600, marginBottom: 4 }}>cURL</div>
          <div style={{ fontSize: 12, marginBottom: 8 }}>No SDK needed</div>
          <div style={{ fontSize: 12 }}>REST endpoints work with any HTTP client</div>
        </div>
      </div>

      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ marginBottom: 16 }}
      >
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Quick start</div>
        </div>
        <div style={{ display: 'flex', gap: 0, marginBottom: 12 }}>
          {['TypeScript', 'Python', 'Go', 'cURL'].map((tab, i) => (
            <Button
              className=""
              variant="ghost"
              type="button"
              key={tab}
              style={{
                background: i === 0 ? 'var(--primary)' : 'transparent',
                color: i === 0 ? '#fff' : 'var(--muted-foreground)',
                borderRadius: 3,
              }}
            >
              {tab}
            </Button>
          ))}
        </div>
        <pre style={codeBlockStyle}>{QUICK_START_TS}</pre>
      </div>

      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ marginBottom: 16 }}
      >
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Subscribe to changes</div>
        </div>
        <pre style={codeBlockStyle}>{SUBSCRIBE_CODE}</pre>
      </div>

      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Call a server function</div>
        </div>
        <pre style={codeBlockStyle}>{FUNCTION_CODE}</pre>
      </div>
    </div>
  );
}
