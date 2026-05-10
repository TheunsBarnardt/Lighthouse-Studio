import type React from 'react';

import { Button } from '@/components/ui/button';

function ScoreRing({ score }: { score: number }) {
  const C = 2 * Math.PI * 44;
  const offset = C - (C * score) / 100;
  const color =
    score >= 90 ? 'oklch(0.40 0.14 145)' : score >= 50 ? 'oklch(0.45 0.14 75)' : 'var(--destructive)';
  return (
    <div style={{ width: 80, height: 80, position: 'relative' }}>
      <svg
        viewBox="0 0 100 100"
        style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
      >
        <circle
          fill="none"
          stroke="var(--muted, #e5e7eb)"
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
    desc: 'Visual stability â€” sum of layout shift scores.',
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
    evidence: 'product-1.jpg (240KB), hero-bg.png (480KB), feature-2.jpg (180KB)â€¦',
  },
  {
    name: 'Eliminate render-blocking resources',
    savings: '0.4s',
    desc: '2 stylesheets and 1 script block first paint.',
    evidence: '/css/main.css (24KB) Â· /js/analytics.js (12KB)',
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
    return { icon: 'âœ“', bg: 'oklch(0.96 0.04 145)', color: 'oklch(0.40 0.14 145)' };
  if (status === 'fail')
    return { icon: 'âœ•', bg: 'oklch(0.96 0.04 25)', color: 'var(--destructive)' };
  return { icon: '!', bg: 'oklch(0.97 0.05 75)', color: 'oklch(0.45 0.14 75)' };
}

export default function LighthousePage() {
  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Lighthouse / Performance</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Core Web Vitals Â· Last scan 12 minutes ago Â· Mobile Â· Slow 4G Â· 4Ã— CPU throttle
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            style={{
              width: 180,
              height: 28,
              padding: '0 8px',
              borderRadius: 4,
              border: '1px solid var(--border)',
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
              border: '1px solid var(--border)',
              fontSize: 12,
            }}
          >
            <option>Mobile</option>
            <option>Desktop</option>
          </select>
          <Button size="sm" type="button">
            Re-scan
          </Button>
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
          <div
            key={s.label}
            className="rounded-md border bg-card text-card-foreground p-4"
            style={{ textAlign: 'center' }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <ScoreRing score={s.score} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{s.label}</div>
            <div style={{ fontSize: 11 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Core Web Vitals */}
      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ marginBottom: 16 }}
      >
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">
            Core Web Vitals Â· field data (real users Â· last 28d)
          </div>
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            Passing
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {CWV.map((m) => {
            const c =
              m.status === 'good'
                ? 'oklch(0.40 0.14 145)'
                : m.status === 'medium'
                  ? 'oklch(0.45 0.14 75)'
                  : 'var(--destructive)';
            return (
              <div
                key={m.name}
                style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 4 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
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
                  <div style={{ fontSize: 11 }}>target {m.target}</div>
                </div>
                <div style={{ fontSize: 11 }}>{m.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Opportunities */}
      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ marginBottom: 16 }}
      >
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Opportunities</div>
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            3 found Â· ~1.4s savings
          </span>
        </div>
        {OPPORTUNITIES.map((o) => (
          <div
            key={o.name}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '12px 0',
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
                background: 'oklch(0.97 0.05 75)',
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
                <div style={{ fontSize: 11, fontWeight: 600 }}>Save {o.savings}</div>
              </div>
              <div style={{ fontSize: 11, marginTop: 4 }}>{o.desc}</div>
              <div className="font-mono text-sm" style={{ fontSize: 11, marginTop: 4 }}>
                {o.evidence}
              </div>
            </div>
            <Button variant="outline" size="sm" type="button">
              Open CR
            </Button>
          </div>
        ))}
      </div>

      {/* Diagnostics */}
      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ marginBottom: 16 }}
      >
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Diagnostics</div>
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
                <div style={{ fontSize: 11 }}>
                  {d.value} Â· target {d.target}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trend */}
      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Trend Â· 30 days</div>
        </div>
        <div
          style={{
            height: 100,
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
                background: 'var(--primary)',
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
            marginTop: 8,
          }}
        >
          <span>30 days ago</span>
          <span>Today Â· 92</span>
        </div>
      </div>
    </div>
  );
}
