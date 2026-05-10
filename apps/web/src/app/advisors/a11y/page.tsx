import type React from 'react';

import { Button } from '@/components/ui/button';

function ScoreRing({ score }: { score: number }) {
  const C = 2 * Math.PI * 44;
  const offset = C - (C * score) / 100;
  const color =
    score >= 90 ? 'oklch(0.40 0.14 145)' : score >= 50 ? 'oklch(0.45 0.14 75)' : 'var(--destructive)';
  return (
    <div style={{ width: 96, height: 96, position: 'relative', flexShrink: 0 }}>
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

type AuditStatus = 'pass' | 'warn' | 'fail';

const GROUPS = [
  {
    cat: 'Names and labels',
    items: [
      { name: 'Buttons have accessible names', status: 'pass' as AuditStatus, count: '47/47' },
      {
        name: 'Form elements have associated labels',
        status: 'pass' as AuditStatus,
        count: '23/23',
      },
      { name: 'Links have discernible names', status: 'pass' as AuditStatus, count: '142/142' },
      {
        name: 'Image elements have [alt] attributes',
        status: 'warn' as AuditStatus,
        count: '14/16',
        desc: '2 decorative images missing alt=""',
      },
    ],
  },
  {
    cat: 'Contrast',
    items: [
      {
        name: 'Background and foreground have sufficient contrast',
        status: 'warn' as AuditStatus,
        desc: 'Warning chip text fails AA on light theme Â· ratio 4.2 : 1 (need 4.5)',
      },
      { name: 'Text on images is legible', status: 'pass' as AuditStatus },
    ],
  },
  {
    cat: 'Keyboard',
    items: [
      {
        name: 'All interactive elements are keyboard-focusable',
        status: 'pass' as AuditStatus,
        count: '189/189',
      },
      { name: 'Focus order matches visual order', status: 'pass' as AuditStatus },
      { name: 'Visible focus indicator on all elements', status: 'pass' as AuditStatus },
      { name: 'No keyboard traps', status: 'pass' as AuditStatus },
    ],
  },
  {
    cat: 'ARIA',
    items: [
      { name: 'ARIA attributes are valid and not deprecated', status: 'pass' as AuditStatus },
      { name: '[role] values are valid', status: 'pass' as AuditStatus },
      { name: 'aria-* attributes match their roles', status: 'pass' as AuditStatus },
      { name: 'Hidden content not focusable', status: 'pass' as AuditStatus },
    ],
  },
  {
    cat: 'Best practices',
    items: [
      { name: '<html> has [lang] attribute', status: 'pass' as AuditStatus },
      { name: 'Document has a title', status: 'pass' as AuditStatus },
      { name: 'Heading levels are sequential (no skips)', status: 'pass' as AuditStatus },
      { name: 'Page has at least one <h1>', status: 'pass' as AuditStatus },
    ],
  },
];

export default function A11yPage() {
  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Accessibility Advisor</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            WCAG 2.1 Level AA Â· axe-core + Lighthouse Â· Last scan 12 minutes ago
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            style={{
              width: 140,
              height: 28,
              padding: '0 8px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              fontSize: 12,
            }}
          >
            <option>WCAG 2.1 AA</option>
            <option>WCAG 2.1 AAA</option>
            <option>WCAG 2.2 AA</option>
          </select>
          <Button size="sm" type="button">
            Re-scan
          </Button>
        </div>
      </div>

      {/* Score card */}
      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16 }}
      >
        <ScoreRing score={96} />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Accessibility score
          </div>
          <div style={{ fontWeight: 600, fontSize: 16, marginTop: 4 }}>
            Almost perfect â€” 2 contrast warnings to fix
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Score based on axe-core automated checks. Manual testing recommended for complete
            coverage.
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <span style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>17</span> passed
            </span>
            <span style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>2</span> warnings
            </span>
            <span style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>0</span> failed
            </span>
          </div>
        </div>
      </div>

      {/* Top finding */}
      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{
          marginBottom: 16,
          background: 'oklch(0.97 0.05 75)',
          borderColor: 'oklch(0.45 0.14 75)',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Top finding Â· contrast</div>
        <div style={{ fontSize: 13, marginBottom: 12 }}>
          Warning chip text on warning background fails WCAG AA on light theme. Contrast ratio{' '}
          <strong>4.2 : 1</strong>, requires <strong>4.5 : 1</strong> for normal text.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" size="sm" type="button">
            Open in token editor
          </Button>
          <Button variant="outline" size="sm" type="button">
            Suppress (1 instance)
          </Button>
          <Button size="sm" type="button">
            Auto-fix
          </Button>
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
              {g.items.filter((i) => i.status === 'pass').length} of {g.items.length} passing
            </div>
          </div>
          {g.items.map((item) => {
            const iconBg =
              item.status === 'pass'
                ? 'oklch(0.96 0.04 145)'
                : item.status === 'fail'
                  ? 'oklch(0.96 0.04 25)'
                  : 'oklch(0.97 0.05 75)';
            const iconColor =
              item.status === 'pass'
                ? 'oklch(0.40 0.14 145)'
                : item.status === 'fail'
                  ? 'var(--destructive)'
                  : 'oklch(0.45 0.14 75)';
            return (
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
                    background: iconBg,
                    color: iconColor,
                  }}
                >
                  {item.status === 'pass' ? 'âœ“' : item.status === 'fail' ? 'âœ•' : '!'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{item.name}</div>
                    {'count' in item && item.count && (
                      <div className="tabular-nums" style={{ fontSize: 11 }}>
                        {item.count}
                      </div>
                    )}
                  </div>
                  {'desc' in item && item.desc && (
                    <div style={{ fontSize: 11, marginTop: 4 }}>{item.desc}</div>
                  )}
                </div>
                {item.status !== 'pass' && (
                  <Button variant="outline" size="sm" type="button">
                    Fix
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
