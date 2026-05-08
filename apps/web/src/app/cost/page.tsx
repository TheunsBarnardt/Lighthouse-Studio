// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const STAGE_COSTS = [
  { stage: 'Stage 1 · Intent', cost: 0.4, calls: 12, avg: '$0.033 avg' },
  { stage: 'Stage 2 · PRD', cost: 1.8, calls: 47, avg: '$0.038 avg' },
  { stage: 'Stage 3 · Design tokens', cost: 0.8, calls: 23, avg: '$0.035 avg' },
  { stage: 'Stage 4 · Schema synthesis', cost: 1.2, calls: 34, avg: '$0.035 avg' },
  { stage: 'Stage 6 · UI generation', cost: 12.4, calls: 142, avg: '$0.087 avg · Opus 4.7' },
  { stage: 'Stage 7 · Code generation', cost: 4.2, calls: 87, avg: '$0.048 avg' },
  { stage: 'Stage 8 · Tests', cost: 1.4, calls: 47, avg: '$0.030 avg' },
  { stage: 'Stage 9 · Deployment', cost: 0.6, calls: 47, avg: '$0.013 avg · pre-flight check' },
  { stage: 'Stage 10 · Maintenance', cost: 0.6, calls: 18, avg: '$0.033 avg · auto-triage' },
];

const PROJECTS = [
  { name: 'Internal Sales CRM', cost: 38.2, pct: 77.5, calls: 412 },
  { name: 'Marketing Blog', cost: 11.1, pct: 22.5, calls: 98 },
];

const SOURCES = [
  { source: 'AI · Anthropic Claude', cost: 23.4, pct: 47.5, trend: '+12%' },
  { source: 'AI · OpenAI (fallback)', cost: 2.8, pct: 5.7, trend: '+3%' },
  { source: 'Infrastructure · Compute', cost: 14.2, pct: 28.8, trend: 'stable' },
  { source: 'Storage · Files + Backups', cost: 5.3, pct: 10.8, trend: 'stable' },
  { source: 'Bandwidth · Egress', cost: 3.6, pct: 7.3, trend: '+8%' },
];

// ---------------------------------------------------------------------------
// MiniBar
// ---------------------------------------------------------------------------

function MiniBar({ pct, warn }: { pct: number; warn?: boolean }) {
  return (
    <div
      style={{
        height: 6,
        borderRadius: 3,
        background: 'var(--bg-surface-3)',
        overflow: 'hidden',
        width: 120,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${String(pct)}%`,
          borderRadius: 3,
          background: warn ? 'var(--fg-warning, #d97706)' : 'var(--accent-primary, #3b6cf4)',
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sparkline
// ---------------------------------------------------------------------------

const SPEND_DATA = [34, 36, 38, 35, 40, 42, 39, 43, 45, 41, 44, 46, 48, 47, 49];

function SpendSparkline() {
  const W = 600;
  const H = 80;
  const max = 55;
  const pts = SPEND_DATA.map((v, i) => {
    const x = (i / (SPEND_DATA.length - 1)) * W;
    const y = H - (v / max) * H;
    return `${String(x)},${String(y)}`;
  }).join(' ');
  const area = `0,${String(H)} ${pts} ${String(W)},${String(H)}`;

  return (
    <svg
      viewBox={`0 0 ${String(W)} ${String(H)}`}
      preserveAspectRatio="none"
      style={{ height: 80, width: '100%' }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cost-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.50 0.20 250)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="oklch(0.50 0.20 250)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#cost-grad)" />
      <polyline points={pts} fill="none" stroke="oklch(0.50 0.20 250)" strokeWidth="1.5" />
      <line
        x1="0"
        y1={String(H - (50 / max) * H)}
        x2={String(W)}
        y2={String(H - (50 / max) * H)}
        stroke="oklch(0.55 0.18 25)"
        strokeWidth="1"
        strokeDasharray="4 2"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CostDashboardPage() {
  const totalAI = STAGE_COSTS.reduce((acc, x) => acc + x.cost, 0);

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      {/* Header */}
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h1
            style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', marginBottom: 4 }}
          >
            Cost &amp; Usage
          </h1>
          <p style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>
            Spend across all sources · This month: $49.30 / $50 budget · Forecast: $54.20
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            style={{
              borderRadius: 4,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-surface)',
              color: 'var(--fg-primary)',
              fontSize: 13,
              padding: '4px 8px',
            }}
          >
            <option>This month</option>
            <option>Last 30 days</option>
            <option>Last quarter</option>
            <option>YTD</option>
          </select>
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Export CSV</button>
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Set budget</button>
          <button className="pg-btn pg-btn-primary pg-btn-sm">Optimisation →</button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="pg-grid pg-grid-4" style={{ marginBottom: 24 }}>
        {[
          { label: 'Current month', value: '$49.30', delta: '99% of budget', warn: false },
          {
            label: 'Forecast end of month',
            value: '$54.20',
            delta: '+8.4% over budget',
            warn: true,
          },
          { label: 'vs prior month', value: '+12%', delta: '$5.40 increase', warn: false },
          { label: 'Top driver', value: 'AI', delta: '$23.40 · 47.5%', warn: false },
        ].map((s) => (
          <div key={s.label} className="pg-stat-card">
            <div className="pg-stat-label">{s.label}</div>
            <div
              className="pg-stat-value pg-tabular"
              style={{ color: s.warn ? 'var(--fg-warning, #d97706)' : undefined }}
            >
              {s.value}
            </div>
            <div
              className="pg-stat-delta"
              style={{ color: s.warn ? 'var(--fg-warning, #d97706)' : undefined }}
            >
              {s.delta}
            </div>
          </div>
        ))}
      </div>

      {/* Spend trend chart */}
      <div className="pg-card" style={{ marginBottom: 16 }}>
        <div
          className="pg-card-header"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <span className="pg-card-title" style={{ fontSize: 13 }}>
            Spend trend · 90 days
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 11,
              color: 'var(--fg-tertiary)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  display: 'inline-block',
                  height: 2,
                  width: 24,
                  background: 'oklch(0.50 0.20 250)',
                }}
              />
              Actual spend
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  display: 'inline-block',
                  height: 0,
                  width: 24,
                  borderTop: '1px dashed oklch(0.55 0.18 25)',
                }}
              />
              Budget ($50)
            </span>
          </div>
        </div>
        <div style={{ padding: 12, background: 'var(--bg-canvas)' }}>
          <SpendSparkline />
          <div
            style={{
              marginTop: 4,
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 10,
              color: 'var(--fg-tertiary)',
            }}
          >
            <span>Feb</span>
            <span>Mar</span>
            <span>Apr</span>
            <span>May (current)</span>
          </div>
        </div>
      </div>

      {/* Source breakdown + Project breakdown side by side */}
      <div
        className="pg-grid"
        style={{ gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}
      >
        <div className="pg-card">
          <div className="pg-card-header">
            <span className="pg-card-title" style={{ fontSize: 13 }}>
              By source
            </span>
          </div>
          <div>
            {SOURCES.map((s, idx) => (
              <div
                key={s.source}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 16px',
                  borderTop: idx === 0 ? undefined : '1px solid var(--border-default)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--fg-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s.source}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>Trend: {s.trend}</div>
                </div>
                <MiniBar pct={s.pct} warn={s.pct > 40} />
                <div
                  style={{
                    width: 56,
                    textAlign: 'right',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--fg-primary)',
                  }}
                  className="pg-tabular"
                >
                  ${s.cost.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pg-card">
          <div className="pg-card-header">
            <span className="pg-card-title" style={{ fontSize: 13 }}>
              By project
            </span>
          </div>
          <div>
            {PROJECTS.map((p, idx) => (
              <div
                key={p.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderTop: idx === 0 ? undefined : '1px solid var(--border-default)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-primary)' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>
                    {p.calls} AI calls · {p.pct}% of total
                  </div>
                </div>
                <MiniBar pct={p.pct} />
                <div
                  style={{
                    width: 56,
                    textAlign: 'right',
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--fg-primary)',
                  }}
                  className="pg-tabular"
                >
                  ${p.cost.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* By pipeline stage */}
      <div className="pg-card" style={{ marginBottom: 16 }}>
        <div className="pg-card-header">
          <span className="pg-card-title" style={{ fontSize: 13 }}>
            By pipeline stage
          </span>
        </div>
        <div className="pg-table-wrap">
          <table className="pg-data-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th style={{ textAlign: 'right' }}>Cost</th>
                <th style={{ textAlign: 'right' }}>AI calls</th>
                <th>Avg / call</th>
                <th style={{ width: 128 }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {STAGE_COSTS.map((s) => {
                const pct = Math.round((s.cost / totalAI) * 100);
                return (
                  <tr key={s.stage}>
                    <td style={{ fontSize: 13, color: 'var(--fg-primary)' }}>{s.stage}</td>
                    <td style={{ textAlign: 'right', fontSize: 13 }} className="pg-tabular">
                      ${s.cost.toFixed(2)}
                    </td>
                    <td
                      style={{ textAlign: 'right', fontSize: 13, color: 'var(--fg-secondary)' }}
                      className="pg-tabular"
                    >
                      {s.calls}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>{s.avg}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            height: 4,
                            borderRadius: 2,
                            width: Math.max(pct * 1.2, 4),
                            background: 'var(--accent-primary)',
                            maxWidth: 80,
                          }}
                        />
                        <span
                          style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}
                          className="pg-tabular"
                        >
                          {pct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Budget alert */}
      <div
        style={{
          borderRadius: 6,
          border: '1px solid var(--fg-warning, #d97706)',
          background: 'oklch(0.97 0.03 75)',
          padding: 16,
        }}
      >
        <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-warning, #b45309)' }}>
          ⚠ Budget alert: forecast exceeds monthly budget by $4.20
        </p>
        <p style={{ marginTop: 4, fontSize: 12, color: 'var(--fg-secondary)' }}>
          UI generation (Stage 6) is the top driver. Consider switching to a less expensive model
          for UI generation iterations, or reviewing prompt efficiency. Go to Optimisation Advisor
          for specific recommendations.
        </p>
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button className="pg-btn pg-btn-secondary pg-btn-sm">View optimisations</button>
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Increase budget</button>
        </div>
      </div>
    </div>
  );
}
