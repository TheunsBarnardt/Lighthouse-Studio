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
  { name: '└ auth.verify_jwt', indent: 1, left: 0, width: 1.2, colorType: 'api', duration: '15ms' },
  { name: '└ db.query', indent: 1, left: 1.5, width: 18, colorType: 'db', duration: '224ms' },
  {
    name: '  └ pg.select deals',
    indent: 2,
    left: 1.5,
    width: 18,
    colorType: 'db',
    duration: '218ms',
  },
  { name: '└ csv.serialize', indent: 1, left: 20, width: 8, colorType: 'fn', duration: '94ms' },
  { name: '└ storage.upload', indent: 1, left: 28, width: 70, colorType: 'ext', duration: '874ms' },
  {
    name: '  └ b2.put_object',
    indent: 2,
    left: 28,
    width: 68,
    colorType: 'ext',
    duration: '847ms',
  },
  { name: '└ storage.sign_url', indent: 1, left: 98, width: 2, colorType: 'api', duration: '28ms' },
];

const SPAN_COLORS: Record<SpanDef['colorType'], string> = {
  api: 'var(--accent-primary)',
  db: 'oklch(0.55 0.16 145)',
  fn: 'oklch(0.55 0.16 75)',
  ext: 'oklch(0.55 0.18 25)',
};

function durationColor(ms: number): string {
  if (ms > 5000) return 'var(--fg-danger)';
  if (ms > 1000) return 'var(--fg-warning)';
  return '';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TracesPage() {
  return (
    <div className="pg-page" style={{ maxWidth: 1400 }}>
      {/* Header */}
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Traces
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            Distributed tracing · OpenTelemetry · 1.2M spans · last 24 hours
          </div>
        </div>
        <div className="pg-page-header-actions">
          <input
            style={{
              width: 280,
              height: 28,
              padding: '0 8px',
              fontSize: 13,
              border: '1px solid var(--border-default)',
              borderRadius: 4,
              background: 'var(--bg-canvas)',
              color: 'var(--fg-primary)',
            }}
            placeholder="trace ID, endpoint, or filter..."
          />
          <select
            style={{
              width: 120,
              height: 28,
              padding: '0 8px',
              fontSize: 13,
              border: '1px solid var(--border-default)',
              borderRadius: 4,
              background: 'var(--bg-canvas)',
              color: 'var(--fg-primary)',
            }}
          >
            <option>Last hour</option>
            <option>Last 24h</option>
          </select>
          <button className="pg-btn pg-btn-primary pg-btn-sm">Search</button>
        </div>
      </div>

      {/* Content: trace list + flame graph */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        {/* Recent traces */}
        <div className="pg-card">
          <div className="pg-card-header">
            <div className="pg-card-title">Recent traces</div>
          </div>
          <div className="pg-table-wrap">
            <table className="pg-data-table">
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th className="pg-tabular" style={{ textAlign: 'right' }}>
                    Duration
                  </th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {TRACES.map((trace) => (
                  <tr key={trace.id} style={{ cursor: 'pointer' }}>
                    <td>
                      <div
                        className="pg-mono"
                        style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-primary)' }}
                      >
                        {trace.endpoint}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 2 }}>
                        {trace.id} · {trace.spans} spans · {trace.when}
                      </div>
                    </td>
                    <td
                      className="pg-tabular"
                      style={{
                        textAlign: 'right',
                        fontSize: 12,
                        color: durationColor(trace.duration) || 'var(--fg-secondary)',
                      }}
                    >
                      {trace.duration.toLocaleString()}ms
                    </td>
                    <td>
                      {trace.status === 'success' ? (
                        <span className="pg-badge pg-badge-success">OK</span>
                      ) : (
                        <span className="pg-badge pg-badge-danger">Error</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trace detail / flame graph */}
        <div className="pg-card">
          <div className="pg-card-header">
            <div className="pg-card-title">Trace · trace_a3f291c</div>
            <span style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>
              POST /functions/v1/exportDealsCSV · 1,247ms · 8 spans
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
                color: 'var(--fg-tertiary)',
                paddingBottom: 4,
                borderBottom: '1px solid var(--border-default)',
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
                  className="pg-mono"
                  style={{
                    color: i === 0 ? 'var(--fg-primary)' : 'var(--fg-secondary)',
                    fontWeight: i === 0 ? 600 : 400,
                  }}
                >
                  {span.name}
                </span>
                <div
                  style={{
                    height: 16,
                    background: 'var(--bg-canvas)',
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
                <span
                  className="pg-tabular"
                  style={{ textAlign: 'right', color: 'var(--fg-secondary)' }}
                >
                  {span.duration}
                </span>
              </div>
            ))}
          </div>

          {/* Insights */}
          <div
            className="pg-card"
            style={{
              margin: 16,
              marginTop: 12,
              background: 'var(--bg-canvas)',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--fg-tertiary)',
                marginBottom: 8,
              }}
            >
              Insights
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-primary)' }}>
              <strong>70% of total time spent in Backblaze B2 upload.</strong> Consider streaming
              the response instead of buffering. Could reduce p95 from 1.2s to ~400ms.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
