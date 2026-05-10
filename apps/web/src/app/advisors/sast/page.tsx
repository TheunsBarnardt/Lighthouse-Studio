import type React from 'react';

import { Button } from '@/components/ui/button';

function AuditRow({
  status,
  name,
  count,
  desc,
  action,
}: {
  status: 'pass' | 'warn' | 'fail';
  name: string;
  count?: string;
  desc?: string;
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
        ? 'oklch(0.96 0.04 145)'
        : status === 'fail'
          ? 'oklch(0.96 0.04 25)'
          : 'oklch(0.97 0.05 75)',
    color:
      status === 'pass'
        ? 'oklch(0.40 0.14 145)'
        : status === 'fail'
          ? 'var(--destructive)'
          : 'oklch(0.45 0.14 75)',
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
      <div style={iconStyle}>{status === 'pass' ? 'âœ“' : status === 'fail' ? 'âœ•' : '!'}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 500, fontSize: 13 }}>{name}</div>
          {count && <div style={{ fontSize: 11 }}>{count}</div>}
        </div>
        {desc && <div style={{ fontSize: 11, marginTop: 4 }}>{desc}</div>}
      </div>
      {action && status !== 'pass' && (
        <Button variant="outline" size="sm" type="button">
          {action}
        </Button>
      )}
    </div>
  );
}

const GROUPS = [
  {
    cat: 'Dangerous APIs',
    items: [
      {
        name: 'No use of eval() or Function()',
        status: 'pass' as const,
        count: '0 occurrences across 7 functions',
      },
      { name: 'No use of child_process', status: 'pass' as const, count: '0 occurrences' },
      { name: 'No direct fs.* or net.* calls', status: 'pass' as const, count: '0 occurrences' },
      {
        name: 'No use of process.env outside config',
        status: 'pass' as const,
        count: '0 violations',
      },
    ],
  },
  {
    cat: 'Secrets in code',
    items: [
      {
        name: 'No hardcoded API keys',
        status: 'pass' as const,
        count: '0 detected (TruffleHog rules)',
      },
      { name: 'No hardcoded passwords', status: 'pass' as const, count: '0 detected' },
      { name: 'No hardcoded JWTs', status: 'pass' as const, count: '0 detected' },
      { name: 'No private keys in repo', status: 'pass' as const, count: '0 detected' },
    ],
  },
  {
    cat: 'Common vulnerabilities',
    items: [
      {
        name: 'No SQL string concatenation',
        status: 'warn' as const,
        count: '1 finding Â· /api/search ORDER BY clause',
        desc: 'Identified by SAST Â· also flagged by DAST as PT-014. Use a whitelist of valid sort columns.',
      },
      {
        name: 'No XSS sinks (innerHTML, dangerouslySetInnerHTML)',
        status: 'pass' as const,
        count: '0 violations',
      },
      { name: 'No insecure regex (ReDoS)', status: 'pass' as const, count: '0 violations' },
      { name: 'No path traversal patterns', status: 'pass' as const, count: '0 violations' },
    ],
  },
  {
    cat: 'Code quality (security-adjacent)',
    items: [
      { name: 'No unhandled promise rejections', status: 'pass' as const },
      { name: 'No catch-and-ignore patterns', status: 'pass' as const },
      {
        name: 'Logging sensitive data',
        status: 'pass' as const,
        count: 'No PII or tokens in log statements',
      },
      {
        name: 'Cryptographic operations use approved libs',
        status: 'pass' as const,
        count: 'argon2, jose, crypto.subtle only',
      },
    ],
  },
];

const TREND = [
  3, 2, 4, 3, 2, 1, 2, 3, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1,
];

export default function SastPage() {
  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>SAST Â· Static analysis</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            CodeQL + Semgrep + custom rules Â· Runs on every commit Â· Last run 12 minutes ago
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" type="button">
            Rules
          </Button>
          <Button variant="outline" size="sm" type="button">
            SARIF export
          </Button>
          <Button size="sm" type="button">
            Re-scan
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 16 }}>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Files scanned
          </div>
          <div className="text-[22px] font-semibold tabular-nums">142</div>
          <div className="mt-1 text-[11px] text-muted-foreground">42K LOC</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Rules active
          </div>
          <div className="text-[22px] font-semibold tabular-nums">347</div>
          <div className="mt-1 text-[11px] text-muted-foreground">CodeQL + Semgrep + custom</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Open findings
          </div>
          <div className="text-[22px] font-semibold tabular-nums">1</div>
          <div className="mt-1 text-[11px] text-muted-foreground">1 medium</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Critical / High
          </div>
          <div className="text-[22px] font-semibold tabular-nums">0</div>
          <div className="mt-1 text-[11px] text-muted-foreground text-emerald-600">none open</div>
        </div>
      </div>

      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{
          marginBottom: 16,
          background: 'oklch(0.96 0.04 230)',
          borderColor: 'var(--primary)',
        }}
      >
        <div style={{ fontSize: 13 }}>
          <strong>Defense in depth.</strong> SAST analyses your source code without running it; DAST
          attacks the running app. Findings often correlate â€” the SQL injection found here (
          <span className="font-mono text-sm">/api/search</span>) is also flagged by the Pentest
          advisor as PT-014.
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
              {g.items.filter((i) => i.status === 'pass').length} of {g.items.length}
            </div>
          </div>
          {g.items.map((item) => (
            <AuditRow key={item.name} {...item} action="View" />
          ))}
        </div>
      ))}

      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Findings Â· 30 days</div>
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
              style={{
                flex: 1,
                height: `${String(v * 22)}%`,
                background: v >= 3 ? 'oklch(0.45 0.14 75)' : 'oklch(0.40 0.14 145)',
                borderRadius: '2px 2px 0 0',
                opacity: 0.85,
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
          <span>30 days ago Â· 3 open</span>
          <span>Today Â· 1 open</span>
        </div>
      </div>
    </div>
  );
}
