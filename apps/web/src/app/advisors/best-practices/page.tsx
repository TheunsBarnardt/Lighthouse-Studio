import type React from 'react';

import { Button } from '@/components/ui/button';

function ScoreRing({ score }: { score: number }) {
  const C = 2 * Math.PI * 44;
  const offset = C - (C * score) / 100;
  const color =
    score >= 90 ? 'var(--fg-success)' : score >= 50 ? 'var(--fg-warning)' : 'var(--fg-danger)';
  return (
    <div style={{ width: 96, height: 96, position: 'relative', flexShrink: 0 }}>
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
          fontSize: 28,
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

const GROUPS = [
  {
    cat: 'Trust and safety',
    items: [
      { name: 'Uses HTTPS', desc: undefined },
      { name: "No mixed content (HTTPS pages don't load HTTP resources)", desc: undefined },
      {
        name: 'Has a Content Security Policy',
        desc: 'CSP header detected · strict-dynamic with nonces',
      },
      { name: 'Has a strong HSTS policy', desc: 'max-age=31536000; includeSubDomains; preload' },
    ],
  },
  {
    cat: 'Browser compatibility',
    items: [
      { name: 'No browser errors logged to the console', desc: undefined },
      { name: 'Page has the HTML doctype', desc: undefined },
      { name: 'Properly defines charset', desc: 'UTF-8' },
      { name: 'Source maps available for production', desc: undefined },
    ],
  },
  {
    cat: 'Modern web standards',
    items: [
      { name: 'Avoids deprecated APIs', desc: undefined },
      { name: 'Avoids document.write()', desc: undefined },
      { name: 'Uses passive listeners for scroll-blocking events', desc: undefined },
      { name: 'Avoids requesting geolocation/notifications on page load', desc: undefined },
    ],
  },
  {
    cat: 'User trust',
    items: [
      { name: 'Images have explicit width and height', desc: 'Prevents layout shifts' },
      { name: 'Avoids requesting permissions out of context', desc: undefined },
      { name: 'Page has valid <noindex> for unindexable pages', desc: undefined },
      { name: 'No use of unload event listener', desc: undefined },
    ],
  },
];

const passCount = GROUPS.flatMap((g) => g.items).length;

export default function BestPracticesPage() {
  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Best Practices</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            HTTPS, modern APIs, console hygiene · Last scan 12 minutes ago
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" type="button">
            Re-scan
          </Button>
        </div>
      </div>

      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16 }}
      >
        <ScoreRing score={100} />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Best Practices score
          </div>
          <div style={{ fontWeight: 600, fontSize: 16, marginTop: 4 }}>
            Excellent — all checks passing
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            {passCount} of {passCount} checks passed.
          </div>
        </div>
      </div>

      {GROUPS.map((g) => (
        <div
          className="rounded-md border bg-card text-card-foreground p-4"
          key={g.cat}
          style={{ marginBottom: 16 }}
        >
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">{g.cat}</div>
            <div style={{ fontSize: 11 }}>
              {g.items.length} of {g.items.length}
            </div>
          </div>
          {g.items.map((item) => (
            <div
              key={item.name}
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
                  background: 'var(--bg-success-subtle)',
                }}
              >
                ✓
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{item.name}</div>
                {item.desc && <div style={{ fontSize: 11, marginTop: 4 }}>{item.desc}</div>}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
