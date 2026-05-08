import type React from 'react';

function ScoreRing({ score }: { score: number }) {
  const C = 2 * Math.PI * 44;
  const offset = C - (C * score) / 100;
  const color =
    score >= 90 ? 'var(--fg-success)' : score >= 50 ? 'var(--fg-warning)' : 'var(--fg-danger)';
  return (
    <div style={{ width: 80, height: 80, position: 'relative' }}>
      <svg
        viewBox="0 0 100 100"
        style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
      >
        <circle
          fill="none"
          stroke="var(--bg-hover, #e5e7eb)"
          strokeWidth={8}
          cx={50}
          cy={50}
          r={44}
        />
        <circle
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          cx={50}
          cy={50}
          r={44}
          strokeDasharray={C}
          strokeDashoffset={offset}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          fontWeight: 700,
          color,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {score}
      </div>
    </div>
  );
}

type AuditStatus = 'pass' | 'warn' | 'fail';

const CWV = [
  {
    name: 'Largest Contentful Paint (LCP)',
    value: '1.8s',
    target: '< 2.5s',
    status: 'good' as const,
    desc: 'Time until largest visible element renders.',
  },
  {
    name: 'Cumulative Layout Shift (CLS)',
    value: '0.04',
    target: '< 0.1',
    status: 'good' as const,
    desc: 'Visual stability — sum of layout shift scores.',
  },
  {
    name: 'Interaction to Next Paint (INP)',
    value: '187ms',
    target: '< 200ms',
    status: 'good' as const,
    desc: 'Latency of user interactions.',
  },
  {
    name: 'First Contentful Paint (FCP)',
    value: '0.9s',
    target: '< 1.8s',
    status: 'good' as const,
    desc: 'Time to first visible text or image.',
  },
  {
    name: 'Time to First Byte (TTFB)',
    value: '210ms',
    target: '< 600ms',
    status: 'good' as const,
    desc: 'Network + server response time.',
  },
  {
    name: 'Total Blocking Time (TBT)',
    value: '420ms',
    target: '< 200ms',
    status: 'medium' as 'good' | 'medium' | 'poor',
    desc: 'Sum of long tasks blocking main thread.',
  },
];

const OPPORTUNITIES = [
  {
    name: 'Defer offscreen images',
    savings: '0.8s',
    desc: '5 images below the fold load eagerly. Add loading="lazy".',
    evidence: 'product-1.jpg (240KB), hero-bg.png (480KB), feature-2.jpg (180KB)…',
  },
  {
    name: 'Eliminate render-blocking resources',
    savings: '0.4s',
    desc: '2 stylesheets and 1 script block first paint.',
    evidence: '/css/main.css (24KB) · /js/analytics.js (12KB)',
  },
  {
    name: 'Properly size images',
    savings: '180KB',
    desc: 'Serve images at displayed dimensions.',
    evidence: 'logo.png served at 800x600, displayed at 200x150',
  },
];

const DIAGNOSTICS: { name: string; status: AuditStatus; value: string; target: string }[] = [
  {
    name: 'Avoid enormous network payloads',
    status: 'pass',
    value: '1.2MB total',
    target: '< 1.5MB',
  },
  { name: 'Minimise main-thread work', status: 'warn', value: '2.4s', target: '< 2.0s' },
  { name: 'Reduce JavaScript execution time', status: 'pass', value: '1.8s', target: '< 2.0s' },
  {
    name: 'Avoid serving legacy JavaScript to modern browsers',
    status: 'pass',
    value: '0KB',
    target: '0KB',
  },
  {
    name: 'Image formats: serve WebP/AVIF',
    status: 'warn',
    value: '4 images in JPG',
    target: 'all WebP+',
  },
  { name: 'Use HTTP/2 or HTTP/3', status: 'pass', value: 'h2', target: 'h2 or h3' },
];

const TREND = [
  78, 80, 82, 81, 84, 86, 84, 87, 89, 87, 88, 86, 89, 90, 89, 91, 90, 92, 91, 90, 92, 93, 91, 92,
  90, 92, 91, 93, 92, 92,
];

function auditIcon(status: AuditStatus) {
  if (status === 'pass')
    return { icon: '✓', bg: 'var(--bg-success-subtle)', color: 'var(--fg-success)' };
  if (status === 'fail')
    return { icon: '✕', bg: 'var(--bg-danger-subtle)', color: 'var(--fg-danger)' };
  return { icon: '!', bg: 'var(--bg-warning-subtle)', color: 'var(--fg-warning)' };
}

export default function LighthousePage() {
  return (
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Lighthouse / Performance
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            Core Web Vitals · Last scan 12 minutes ago · Mobile · Slow 4G · 4× CPU throttle
          </div>
        </div>
        <div className="pg-page-header-actions">
          <select
            style={{
              width: 180,
              height: 28,
              padding: '0 8px',
              borderRadius: 4,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-canvas)',
              color: 'var(--fg-primary)',
              fontSize: 12,
            }}
          >
            <option>/dashboard</option>
            <option>/deals</option>
            <option>/contacts</option>
            <option>/</option>
          </select>
          <select
            style={{
              width: 120,
              height: 28,
              padding: '0 8px',
              borderRadius: 4,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-canvas)',
              color: 'var(--fg-primary)',
              fontSize: 12,
            }}
          >
            <option>Mobile</option>
            <option>Desktop</option>
          </select>
          <button className="pg-btn pg-btn-primary pg-btn-sm">Re-scan</button>
        </div>
      </div>

      {/* Four score rings */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[
          { score: 92, label: 'Performance', sub: 'Speed and responsiveness' },
          { score: 96, label: 'Accessibility', sub: 'WCAG 2.1 AA' },
          { score: 100, label: 'Best Practices', sub: 'HTTPS, console, modern APIs' },
          { score: 78, label: 'SEO', sub: 'Crawlability, meta, structured data' },
        ].map((s) => (
          <div key={s.label} className="pg-card" style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <ScoreRing score={s.score} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Core Web Vitals */}
      <div className="pg-card" style={{ marginBottom: 16 }}>
        <div className="pg-card-header">
          <div className="pg-card-title">Core Web Vitals · field data (real users · last 28d)</div>
          <span className="pg-badge pg-badge-success">Passing</span>
        </div>
        <div className="pg-grid pg-grid-3">
          {CWV.map((m) => {
            const c =
              m.status === 'good'
                ? 'var(--fg-success)'
                : m.status === 'medium'
                  ? 'var(--fg-warning)'
                  : 'var(--fg-danger)';
            return (
              <div
                key={m.name}
                style={{ padding: 12, border: '1px solid var(--border-default)', borderRadius: 4 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'var(--fg-secondary)',
                    }}
                  >
                    {m.name}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 600,
                      color: c,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {m.value}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>target {m.target}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>{m.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Opportunities */}
      <div className="pg-card" style={{ marginBottom: 16 }}>
        <div className="pg-card-header">
          <div className="pg-card-title">Opportunities</div>
          <span className="pg-badge pg-badge-warning">3 found · ~1.4s savings</span>
        </div>
        {OPPORTUNITIES.map((o) => (
          <div
            key={o.name}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 0',
              borderBottom: '1px solid var(--border-default)',
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
                marginTop: 2,
                background: 'var(--bg-warning-subtle)',
                color: 'var(--fg-warning)',
              }}
            >
              !
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ fontWeight: 500, fontSize: 13 }}>{o.name}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-success)', fontWeight: 600 }}>
                  Save {o.savings}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--fg-secondary)', marginTop: 4 }}>
                {o.desc}
              </div>
              <div
                className="pg-mono"
                style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 4 }}
              >
                {o.evidence}
              </div>
            </div>
            <button className="pg-btn pg-btn-secondary pg-btn-sm">Open CR</button>
          </div>
        ))}
      </div>

      {/* Diagnostics */}
      <div className="pg-card" style={{ marginBottom: 16 }}>
        <div className="pg-card-header">
          <div className="pg-card-title">Diagnostics</div>
        </div>
        {DIAGNOSTICS.map((d) => {
          const ai = auditIcon(d.status);
          return (
            <div
              key={d.name}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                padding: '12px 0',
                borderBottom: '1px solid var(--border-default)',
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: 2,
                  background: ai.bg,
                  color: ai.color,
                }}
              >
                {ai.icon}
              </div>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{d.name}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>
                  {d.value} · target {d.target}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trend */}
      <div className="pg-card">
        <div className="pg-card-header">
          <div className="pg-card-title">Trend · 30 days</div>
        </div>
        <div
          style={{
            height: 100,
            background: 'var(--bg-canvas)',
            borderRadius: 4,
            padding: 12,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 3,
          }}
        >
          {TREND.map((v, i) => (
            <div
              key={i}
              title={String(v)}
              style={{
                flex: 1,
                height: `${String(v - 70)}%`,
                background: 'var(--accent-primary)',
                borderRadius: '2px 2px 0 0',
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--fg-tertiary)',
            marginTop: 8,
          }}
        >
          <span>30 days ago</span>
          <span>Today · 92</span>
        </div>
      </div>
    </div>
  );
}
