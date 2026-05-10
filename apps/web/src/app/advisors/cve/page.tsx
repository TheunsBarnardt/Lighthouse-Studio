'use client';

import { Button } from '@/components/ui/button';

const VULNS = [
  {
    id: 'GHSA-jf85-cpcp-j695',
    cve: 'CVE-2020-8203',
    pkg: 'lodash',
    current: '4.17.20',
    fixed: '4.17.21',
    severity: 'high',
    cvss: 7.4,
    type: 'Prototype Pollution',
    desc: 'Versions of lodash prior to 4.17.21 are vulnerable to Prototype Pollution via zipObjectDeep.',
    exploitable: true,
    age: '2 days ago',
    via: 'direct dependency',
  },
  {
    id: 'GHSA-72xf-g2v4-qvf3',
    cve: 'CVE-2024-28849',
    pkg: 'follow-redirects',
    current: '1.15.4',
    fixed: '1.15.6',
    severity: 'medium',
    cvss: 6.5,
    type: 'Information Exposure',
    desc: 'follow-redirects leaks the proxy authorization header on cross-origin redirects.',
    exploitable: false,
    age: '5 days ago',
    via: 'transitive Â· axios â†’ follow-redirects',
  },
  {
    id: 'GHSA-c2qf-rxjj-qqgw',
    cve: 'CVE-2023-26159',
    pkg: 'follow-redirects',
    current: '1.15.4',
    fixed: '1.15.4',
    severity: 'medium',
    cvss: 5.3,
    type: 'Improper Input Validation',
    desc: 'Improper Input Validation in follow-redirects.',
    exploitable: false,
    age: '1 week ago',
    via: 'transitive Â· axios â†’ follow-redirects',
  },
  {
    id: 'GHSA-cwfw-4gq5-mrqx',
    cve: 'CVE-2024-21484',
    pkg: 'jose',
    current: '4.15.4',
    fixed: '4.15.5',
    severity: 'low',
    cvss: 3.7,
    type: 'DoS',
    desc: 'Denial of Service via memory exhaustion when parsing tokens with deeply nested structures.',
    exploitable: false,
    age: '2 weeks ago',
    via: 'direct dependency',
  },
];

const ECOSYSTEM = [
  { name: 'npm (production)', deps: 142, vulns: 2, audited: '2 min ago' },
  { name: 'npm (dev)', deps: 270, vulns: 2, audited: '2 min ago' },
  { name: 'PostgreSQL extensions', deps: 5, vulns: 0, audited: 'daily' },
  { name: 'Container base images', deps: 3, vulns: 0, audited: '4 hours ago' },
];

export default function CvePage() {
  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>CVE / Dependencies</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Continuous vulnerability monitoring Â· GHSA Â· NVD Â· OSV.dev Â· Last scan 2 minutes ago
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" type="button">
            SBOM export
          </Button>
          <Button variant="outline" size="sm" type="button">
            Settings
          </Button>
          <Button size="sm" type="button">
            Re-scan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 16 }}>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Total vulnerabilities
          </div>
          <div className="text-[22px] font-semibold tabular-nums">4</div>
          <div className="mt-1 text-[11px] text-muted-foreground">across 412 deps</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            High
          </div>
          <div className="text-[22px] font-semibold tabular-nums">1</div>
          <div className="mt-1 text-[11px] text-muted-foreground">CVSS â‰¥ 7.0</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Medium
          </div>
          <div className="text-[22px] font-semibold tabular-nums">2</div>
          <div className="mt-1 text-[11px] text-muted-foreground">4.0â€“6.9</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Auto-fixable
          </div>
          <div className="text-[22px] font-semibold tabular-nums">3</div>
          <div className="mt-1 text-[11px] text-muted-foreground text-emerald-600">
            via patch update
          </div>
        </div>
      </div>

      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{
          marginBottom: 16,
          background: 'oklch(0.96 0.04 25)',
          borderColor: 'var(--destructive)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              1 high-severity vulnerability requires action
            </div>
            <div style={{ fontSize: 13 }}>
              <span className="font-mono text-sm">lodash@4.17.20</span> has a known Prototype
              Pollution vulnerability. Patch available:{' '}
              <span className="font-mono text-sm">4.17.21</span>. AI can auto-create a CR.
            </div>
          </div>
          <Button size="sm" type="button">
            âœ¦ Auto-create CR
          </Button>
        </div>
      </div>

      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ marginBottom: 16 }}
      >
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Open advisories</div>
        </div>
        {VULNS.map((v) => (
          <div key={v.id} style={{ padding: '16px 0' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  className={`inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground ${v.severity === 'high' ? 'inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive' : v.severity === 'medium' ? 'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground'}`}
                >
                  {v.severity.toUpperCase()} Â· CVSS {v.cvss}
                </span>
                <span className="font-mono text-sm" style={{ fontSize: 11 }}>
                  {v.id}
                </span>
                <span className="font-mono text-sm" style={{ fontSize: 11 }}>
                  {v.cve}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Button variant="ghost" size="sm" type="button">
                  Snooze
                </Button>
                <Button variant="outline" size="sm" type="button">
                  Suppress
                </Button>
                <Button size="sm" type="button">
                  Auto-fix
                </Button>
              </div>
            </div>
            <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
              {v.type} in <span className="font-mono text-sm">{v.pkg}</span>
            </div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>{v.desc}</div>
            <div className="grid grid-cols-4 gap-4" style={{ gap: 12, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 10 }}>Package</div>
                <div className="font-mono text-sm" style={{ fontSize: 11 }}>
                  {v.pkg}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10 }}>Current</div>
                <div className="font-mono text-sm" style={{ fontSize: 11 }}>
                  {v.current}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10 }}>Fixed in</div>
                <div className="font-mono text-sm" style={{ fontSize: 11 }}>
                  {v.fixed}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10 }}>Path</div>
                <div style={{ fontSize: 11 }}>{v.via}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
              {v.exploitable ? (
                <span>âš  Reachable in our code</span>
              ) : (
                <span>Not reachable in our code</span>
              )}
              <span>Â·</span>
              <span>Detected {v.age}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Ecosystems</div>
        </div>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th>Source</th>
                <th className="tabular-nums">Dependencies</th>
                <th className="tabular-nums">Vulnerabilities</th>
                <th>Last audit</th>
              </tr>
            </thead>
            <tbody>
              {ECOSYSTEM.map((e) => (
                <tr key={e.name}>
                  <td>{e.name}</td>
                  <td className="tabular-nums">{e.deps}</td>
                  <td className="tabular-nums">
                    {e.vulns > 0 ? <span>{e.vulns}</span> : <span>{e.vulns}</span>}
                  </td>
                  <td style={{ fontSize: 11 }}>{e.audited}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
