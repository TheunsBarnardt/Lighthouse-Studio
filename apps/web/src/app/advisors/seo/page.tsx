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

type AuditStatus = 'pass' | 'warn' | 'fail';

function AuditRow({
  status,
  name,
  desc,
  action,
}: {
  status: AuditStatus;
  name: string;
  desc: string;
  action?: string;
}) {
  const iconStyle: React.CSSProperties = {
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
    background:
      status === 'pass'
        ? 'var(--bg-success-subtle)'
        : status === 'fail'
          ? 'var(--bg-danger-subtle)'
          : 'var(--bg-warning-subtle)',
    color:
      status === 'pass'
        ? 'var(--fg-success)'
        : status === 'fail'
          ? 'var(--fg-danger)'
          : 'var(--fg-warning)',
  };
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 0',
      }}
    >
      <div style={iconStyle}>{status === 'pass' ? '✓' : status === 'fail' ? '✕' : '!'}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{name}</div>
        <div style={{ fontSize: 11, marginTop: 4 }}>{desc}</div>
      </div>
      {action && status !== 'pass' && (
        <Button variant="outline" size="sm" type="button">
          {action}
        </Button>
      )}
    </div>
  );
}

const AUDITS = [
  {
    cat: 'Crawlability',
    items: [
      {
        name: 'Page has a robots.txt',
        status: 'pass' as AuditStatus,
        desc: 'Detected at /robots.txt · valid syntax',
      },
      {
        name: 'Page has a sitemap.xml',
        status: 'pass' as AuditStatus,
        desc: 'Detected · 47 URLs · last updated 2 hours ago',
      },
      {
        name: 'No noindex meta on indexable pages',
        status: 'pass' as AuditStatus,
        desc: 'All public pages indexable',
      },
      {
        name: 'Canonical URLs set',
        status: 'fail' as AuditStatus,
        desc: '14 pages missing <link rel="canonical">',
      },
    ],
  },
  {
    cat: 'Meta tags',
    items: [
      {
        name: 'Title tag present and under 60 chars',
        status: 'warn' as AuditStatus,
        desc: '3 pages have titles over 60 chars (truncated in SERP)',
      },
      {
        name: 'Meta description present',
        status: 'fail' as AuditStatus,
        desc: '7 pages missing meta description',
      },
      {
        name: 'Open Graph tags (og:title, og:image)',
        status: 'pass' as AuditStatus,
        desc: 'All pages have og:title, og:description, og:image',
      },
      {
        name: 'Twitter card tags',
        status: 'pass' as AuditStatus,
        desc: 'twitter:card="summary_large_image" set on all pages',
      },
    ],
  },
  {
    cat: 'Structured data',
    items: [
      {
        name: 'Schema.org JSON-LD present',
        status: 'warn' as AuditStatus,
        desc: 'Only 4 of 47 pages have structured data',
      },
      { name: 'Valid JSON-LD syntax', status: 'pass' as AuditStatus, desc: 'No parse errors' },
      {
        name: 'Breadcrumb markup',
        status: 'fail' as AuditStatus,
        desc: 'No BreadcrumbList found on any page',
      },
    ],
  },
  {
    cat: 'Internationalisation',
    items: [
      {
        name: 'Lang attribute on <html>',
        status: 'pass' as AuditStatus,
        desc: 'lang="en" on all pages',
      },
      {
        name: 'Hreflang tags for multilingual',
        status: 'pass' as AuditStatus,
        desc: 'Single language site · not applicable',
      },
    ],
  },
];

const allItems = AUDITS.flatMap((a) => a.items);
const passCount = allItems.filter((i) => i.status === 'pass').length;
const warnCount = allItems.filter((i) => i.status === 'warn').length;
const failCount = allItems.filter((i) => i.status === 'fail').length;

const PER_PAGE = [
  { url: '/', score: 92, title: '✓', meta: '✓', sd: '✓ JSON-LD' },
  { url: '/deals', score: 84, title: '✓', meta: '— missing', sd: '— missing' },
  { url: '/contacts', score: 88, title: '✓ (62 chars)', meta: '✓', sd: '— missing' },
  { url: '/dashboard', score: 71, title: '— too long', meta: '— missing', sd: '— missing' },
  { url: '/sign-in', score: 95, title: '✓', meta: '✓', sd: '✓ JSON-LD' },
];

export default function SeoPage() {
  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>SEO Advisor</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Search engine optimisation audit · Last scan 12 minutes ago · 47 pages crawled
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            style={{
              width: 180,
              height: 28,
              padding: '0 8px',
              borderRadius: 4,
              border: '1px solid var(--border-default)',
              fontSize: 12,
            }}
          >
            <option>All pages</option>
            <option>Public pages only</option>
            <option>Single page...</option>
          </select>
          <Button variant="outline" size="sm" type="button">
            Settings
          </Button>
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
        <ScoreRing score={78} />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Overall SEO score
          </div>
          <div style={{ fontWeight: 600, fontSize: 16, marginTop: 4 }}>
            Needs attention — fix the 4 failed audits to reach 90+
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Scoring weighted toward crawlability and meta tags. Structured data and breadcrumbs
            would lift this further.
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <span style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>{passCount}</span> passed
            </span>
            <span style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>{warnCount}</span> warnings
            </span>
            <span style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>{failCount}</span> failed
            </span>
          </div>
        </div>
      </div>

      {AUDITS.map((group) => (
        <div
          className="rounded-md border bg-card text-card-foreground p-4"
          key={group.cat}
          style={{ marginBottom: 16 }}
        >
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">{group.cat}</div>
            <div style={{ fontSize: 11 }}>
              {group.items.filter((i) => i.status === 'pass').length} of {group.items.length}{' '}
              passing
            </div>
          </div>
          {group.items.map((item) => (
            <AuditRow key={item.name} {...item} action="Fix in Designer" />
          ))}
        </div>
      ))}

      {/* Per-page scores */}
      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Per-page scores</div>
        </div>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th>URL</th>
                <th className="tabular-nums">Score</th>
                <th>Title</th>
                <th>Meta description</th>
                <th>Structured data</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {PER_PAGE.map((p) => {
                const c =
                  p.score >= 90
                    ? 'var(--fg-success)'
                    : p.score >= 70
                      ? 'var(--fg-warning)'
                      : 'var(--fg-danger)';
                return (
                  <tr key={p.url}>
                    <td className="font-mono text-sm" style={{ fontSize: 11 }}>
                      {p.url}
                    </td>
                    <td className="tabular-nums" style={{ fontWeight: 600, color: c }}>
                      {p.score}
                    </td>
                    <td style={{ fontSize: 11 }}>{p.title}</td>
                    <td style={{ fontSize: 11 }}>{p.meta}</td>
                    <td style={{ fontSize: 11 }}>{p.sd}</td>
                    <td>
                      <Button className="" variant="ghost" type="button">
                        Inspect
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
