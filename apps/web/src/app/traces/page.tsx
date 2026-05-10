import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Types & static data
// ---------------------------------------------------------------------------

interface Trace {
  id: string;
  endpoint: string;
  duration: number;
  status: 'success' | 'error';
  when: string;
  spans: number;
}

const TRACES: Trace[] = [
  {
    id: 'trace_a3f291c',
    endpoint: 'POST /functions/v1/exportDealsCSV',
    duration: 1247,
    status: 'success',
    when: '12 min ago',
    spans: 8,
  },
  {
    id: 'trace_b8e147a',
    endpoint: 'GET /rest/v1/deals?stage=eq.WON',
    duration: 187,
    status: 'success',
    when: '14 min ago',
    spans: 3,
  },
  {
    id: 'trace_4d92e3c',
    endpoint: 'POST /functions/v1/syncCalendarEvent',
    duration: 8421,
    status: 'error',
    when: '47 min ago',
    spans: 12,
  },
  {
    id: 'trace_7c2f9eb',
    endpoint: 'PATCH /rest/v1/deals/d2a8-...',
    duration: 94,
    status: 'success',
    when: '1h ago',
    spans: 4,
  },
  {
    id: 'trace_2a14d6e',
    endpoint: 'GET /rest/v1/contacts/search',
    duration: 312,
    status: 'success',
    when: '1h ago',
    spans: 5,
  },
];

// Spans for the selected trace (trace_a3f291c), matching the prototype exactly
interface SpanDef {
  name: string;
  indent: number;
  left: number;
  width: number;
  colorType: 'api' | 'db' | 'fn' | 'ext';
  duration: string;
}

const SPANS: SpanDef[] = [
  {
    name: 'edge_function.invoke',
    indent: 0,
    left: 0,
    width: 100,
    colorType: 'fn',
    duration: '1,247ms',
  },
  { name: 'â”” auth.verify_jwt', indent: 1, left: 0, width: 1.2, colorType: 'api', duration: '15ms' },
  { name: 'â”” db.query', indent: 1, left: 1.5, width: 18, colorType: 'db', duration: '224ms' },
  {
    name: '  â”” pg.select deals',
    indent: 2,
    left: 1.5,
    width: 18,
    colorType: 'db',
    duration: '218ms',
  },
  { name: 'â”” csv.serialize', indent: 1, left: 20, width: 8, colorType: 'fn', duration: '94ms' },
  { name: 'â”” storage.upload', indent: 1, left: 28, width: 70, colorType: 'ext', duration: '874ms' },
  {
    name: '  â”” b2.put_object',
    indent: 2,
    left: 28,
    width: 68,
    colorType: 'ext',
    duration: '847ms',
  },
  { name: 'â”” storage.sign_url', indent: 1, left: 98, width: 2, colorType: 'api', duration: '28ms' },
];

const SPAN_COLORS: Record<SpanDef['colorType'], string> = {
  api: 'var(--primary)',
  db: 'oklch(0.55 0.16 145)',
  fn: 'oklch(0.55 0.16 75)',
  ext: 'oklch(0.55 0.18 25)',
};

function durationColor(ms: number): string {
  if (ms > 5000) return 'var(--destructive)';
  if (ms > 1000) return 'oklch(0.45 0.14 75)';
  return '';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TracesPage() {
  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1400 }}>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Traces</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Distributed tracing Â· OpenTelemetry Â· 1.2M spans Â· last 24 hours
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <input
            style={{
              width: 280,
              height: 28,
              padding: '0 8px',
              fontSize: 13,
              border: '1px solid var(--border)',
              borderRadius: 4,
            }}
            placeholder="trace ID, endpoint, or filter..."
          />
          <select
            style={{
              width: 120,
              height: 28,
              padding: '0 8px',
              fontSize: 13,
              border: '1px solid var(--border)',
              borderRadius: 4,
            }}
          >
            <option>Last hour</option>
            <option>Last 24h</option>
          </select>
          <Button size="sm" type="button">
            Search
          </Button>
        </div>
      </div>

      {/* Content: trace list + flame graph */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        {/* Recent traces */}
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">Recent traces</div>
          </div>
          <div className="overflow-hidden rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th className="tabular-nums" style={{ textAlign: 'right' }}>
                    Duration
                  </th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {TRACES.map((trace) => (
                  <tr key={trace.id} style={{ cursor: 'pointer' }}>
                    <td>
                      <div className="font-mono text-sm" style={{ fontSize: 11, fontWeight: 500 }}>
                        {trace.endpoint}
                      </div>
                      <div style={{ fontSize: 11, marginTop: 2 }}>
                        {trace.id} Â· {trace.spans} spans Â· {trace.when}
                      </div>
                    </td>
                    <td
                      className="tabular-nums"
                      style={{
                        textAlign: 'right',
                        fontSize: 12,
                        color: durationColor(trace.duration) || 'var(--muted-foreground)',
                      }}
                    >
                      {trace.duration.toLocaleString()}ms
                    </td>
                    <td>
                      {trace.status === 'success' ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          OK
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                          Error
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trace detail / flame graph */}
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">Trace Â· trace_a3f291c</div>
            <span style={{ fontSize: 12 }}>
              POST /functions/v1/exportDealsCSV Â· 1,247ms Â· 8 spans
            </span>
          </div>

          {/* Span header row */}
          <div style={{ padding: '12px 16px 0' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '240px 1fr 80px',
                gap: 12,
                alignItems: 'center',
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                paddingBottom: 4,
                marginBottom: 8,
              }}
            >
              <span>Span</span>
              <span>Timing</span>
              <span style={{ textAlign: 'right' }}>Duration</span>
            </div>

            {/* Span rows */}
            {SPANS.map((span, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '240px 1fr 80px',
                  gap: 12,
                  alignItems: 'center',
                  padding: '3px 0',
                  paddingLeft: span.indent * 12,
                  fontSize: 11,
                }}
              >
                <span
                  className="font-mono text-sm"
                  style={{
                    color: i === 0 ? 'var(--foreground)' : 'var(--muted-foreground)',
                    fontWeight: i === 0 ? 600 : 400,
                  }}
                >
                  {span.name}
                </span>
                <div
                  style={{
                    height: 16,
                    borderRadius: 2,
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: `${String(span.left)}%`,
                      width: `${String(span.width)}%`,
                      background: SPAN_COLORS[span.colorType],
                      borderRadius: 2,
                    }}
                  />
                </div>
                <span className="tabular-nums" style={{ textAlign: 'right' }}>
                  {span.duration}
                </span>
              </div>
            ))}
          </div>

          {/* Insights */}
          <div
            className="rounded-md border bg-card text-card-foreground p-4"
            style={{
              margin: 16,
              marginTop: 12,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 8,
              }}
            >
              Insights
            </div>
            <div style={{ fontSize: 13 }}>
              <strong>70% of total time spent in Backblaze B2 upload.</strong> Consider streaming
              the response instead of buffering. Could reduce p95 from 1.2s to ~400ms.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
