'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { PipelineStepper } from '../stepper';

type SignalSeverity = 'high' | 'medium' | 'low';
type SignalStatus = 'open' | 'in-flight' | 'resolved';
type CRStatus = 'in-progress' | 'pending-approval' | 'merged';

interface Signal {
  id: string;
  title: string;
  severity: SignalSeverity;
  source: string;
  evidence: string;
  when: string;
  status: SignalStatus;
  owner: string;
}

interface ChangeRequest {
  id: string;
  title: string;
  status: CRStatus;
  scope: string;
  by: string;
  etl: string;
  when: string;
}

const SIGNALS: Signal[] = [
  {
    id: 'SIG-127',
    title: 'TypeError in DealKanbanPage',
    severity: 'high',
    source: 'Stage 6 · UI',
    evidence: '14 occurrences',
    when: '47 min ago',
    status: 'open',
    owner: 'Marcus',
  },
  {
    id: 'SIG-126',
    title: 'Slow query: contacts list',
    severity: 'medium',
    source: 'Stage 4 · Schema',
    evidence: 'p95 1.8s',
    when: '2 hours ago',
    status: 'in-flight',
    owner: 'Tom',
  },
  {
    id: 'SIG-125',
    title: 'User report: cannot save deal',
    severity: 'high',
    source: 'Stage 6 · UI',
    evidence: '3 reports',
    when: '1 hour ago',
    status: 'open',
    owner: '—',
  },
  {
    id: 'SIG-124',
    title: 'CVE: lodash advisory GHSA-jf85',
    severity: 'medium',
    source: 'Dependency',
    evidence: 'auto-detected',
    when: '1 day ago',
    status: 'in-flight',
    owner: 'Marcus',
  },
  {
    id: 'SIG-123',
    title: 'a11y: contrast on warning chip',
    severity: 'low',
    source: 'Stage 3 · Tokens',
    evidence: 'lighthouse',
    when: '1 day ago',
    status: 'open',
    owner: '—',
  },
  {
    id: 'SIG-122',
    title: 'Bundle size +14% on last deploy',
    severity: 'low',
    source: 'Stage 9 · Deploy',
    evidence: 'auto-detected',
    when: '2 days ago',
    status: 'resolved',
    owner: 'Tom',
  },
  {
    id: 'SIG-121',
    title: 'PRD ↔ schema drift: missing field',
    severity: 'medium',
    source: 'Stage 4 · Schema',
    evidence: 'auto-detected',
    when: '3 days ago',
    status: 'resolved',
    owner: 'AI',
  },
];

const CHANGE_REQUESTS: ChangeRequest[] = [
  {
    id: 'CR-42',
    title: 'Fix Kanban drag race condition',
    status: 'in-progress',
    scope: 'Stage 6 → 8',
    by: 'Tom Müller',
    etl: '2h',
    when: '47 min ago',
  },
  {
    id: 'CR-41',
    title: 'Bump lodash to 4.17.22',
    status: 'pending-approval',
    scope: 'Stage 7',
    by: 'AI auto-generated',
    etl: '12m',
    when: '1 day ago',
  },
  {
    id: 'CR-40',
    title: 'Add index on contacts.company',
    status: 'merged',
    scope: 'Stage 4',
    by: 'AI auto-generated',
    etl: '3m',
    when: 'Yesterday',
  },
];

function severityBadge(severity: SignalSeverity) {
  if (severity === 'high')
    return (
      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
        high
      </span>
    );
  if (severity === 'medium')
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        medium
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      low
    </span>
  );
}

function crStatusBadge(status: CRStatus) {
  if (status === 'merged')
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        Merged
      </span>
    );
  if (status === 'in-progress')
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
        In flight
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
      Approval
    </span>
  );
}

export default function MaintenancePage() {
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [triaging, setTriaging] = useState(false);

  const openSignals = SIGNALS.filter((s) => s.status !== 'resolved');
  const resolvedSignals = SIGNALS.filter((s) => s.status === 'resolved');

  const filteredSignals = openSignals.filter(
    (s) => severityFilter === 'all' || s.severity === severityFilter,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PipelineStepper active="maintenance" />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1400 }}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h1 style={{ fontSize: 18 }}>Maintenance · Continuous</h1>
              <div className="subtitle">
                Production signals → change requests → re-deploy. The pipeline keeps running.
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" type="button">
                Settings
              </Button>
              <Button variant="outline" size="sm" type="button">
                Export report
              </Button>
              <Button
                onClick={() => {
                  setTriaging(true);
                }}
                disabled={triaging}
                className="inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                {triaging ? '● Triaging…' : '✦ AI triage'}
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="rounded-md border bg-card p-4">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                Open signals
              </div>
              <div className="text-[22px] font-semibold tabular-nums">{openSignals.length}</div>
              <div className="mt-1 text-[11px] text-muted-foreground text-emerald-600">
                3 new today
              </div>
            </div>
            <div className="rounded-md border bg-card p-4">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                Change requests in flight
              </div>
              <div className="text-[22px] font-semibold tabular-nums">2</div>
              <div className="mt-1 text-[11px] text-muted-foreground">1 awaiting approval</div>
            </div>
            <div className="rounded-md border bg-card p-4">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                MTTR · 30d
              </div>
              <div className="text-[22px] font-semibold tabular-nums">3.4h</div>
              <div className="mt-1 text-[11px] text-muted-foreground text-emerald-600">
                −12% vs prior
              </div>
            </div>
            <div className="rounded-md border bg-card p-4">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
                AI fix rate
              </div>
              <div className="text-[22px] font-semibold tabular-nums">89%</div>
              <div className="mt-1 text-[11px] text-muted-foreground">last 30 days</div>
            </div>
          </div>

          {/* Signals + CRs */}
          <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            {/* Open signals */}
            <div
              className="rounded-md border bg-card text-card-foreground p-4"
              style={{ padding: 0, overflow: 'hidden' }}
            >
              <div
                className="mb-3 flex items-center justify-between border-b pb-3"
                style={{ padding: '12px 16px', borderRadius: 0 }}
              >
                <span className="text-sm font-semibold">Open signals</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={severityFilter}
                    onChange={(e) => {
                      setSeverityFilter(e.target.value);
                    }}
                    className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
                    style={{ cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <option value="all">All severity</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div
                className="overflow-hidden rounded-md border"
                style={{ border: 'none', borderRadius: 0 }}
              >
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Title</th>
                      <th>Severity</th>
                      <th>Source</th>
                      <th>Evidence</th>
                      <th>When</th>
                      <th>Owner</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSignals.map((signal) => (
                      <tr key={signal.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{signal.id}</td>
                        <td style={{ fontSize: 13 }}>{signal.title}</td>
                        <td>{severityBadge(signal.severity)}</td>
                        <td style={{ fontSize: 12 }}>{signal.source}</td>
                        <td style={{ fontSize: 12 }}>{signal.evidence}</td>
                        <td style={{ fontSize: 12 }}>{signal.when}</td>
                        <td style={{ fontSize: 12 }}>{signal.owner}</td>
                        <td>
                          <Button variant="outline" size="xs" type="button">
                            Create CR
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              {/* Change requests */}
              <div className="rounded-md border bg-card text-card-foreground p-4 mb-4">
                <div className="mb-3 flex items-center justify-between border-b pb-3">
                  <span className="text-sm font-semibold">Change requests</span>
                </div>
                {CHANGE_REQUESTS.map((cr, i) => (
                  <div
                    key={cr.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingBottom: 12,
                      marginBottom: i < CHANGE_REQUESTS.length - 1 ? 12 : 0,
                      borderBottom:
                        i < CHANGE_REQUESTS.length - 1 ? '1px solid var(--border-default)' : 'none',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}
                      >
                        <span
                          className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                          style={{ fontFamily: 'monospace', fontSize: 9 }}
                        >
                          {cr.id}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {cr.title}
                        </span>
                      </div>
                      <div style={{ fontSize: 11 }}>
                        {cr.scope} · {cr.by} · {cr.when}
                      </div>
                    </div>
                    {crStatusBadge(cr.status)}
                  </div>
                ))}
              </div>

              {/* Signal sources */}
              <div className="rounded-md border bg-card text-card-foreground p-4">
                <div className="mb-3 flex items-center justify-between border-b pb-3">
                  <span className="text-sm font-semibold">Signal sources</span>
                </div>
                {[
                  ['Error tracking', 'Sentry · live', 'var(--fg-success)'],
                  ['User reports', '3 open', 'var(--fg-primary)'],
                  ['CVE feed', 'GHSA · live', 'var(--fg-success)'],
                  ['Lighthouse', 'daily', 'var(--fg-success)'],
                  ['Drift detection', 'on commit', 'var(--fg-success)'],
                  ['DB advisor', 'hourly', 'var(--fg-success)'],
                ].map(([k, v, c]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0"
                  >
                    <span className="text-muted-foreground">{k}</span>
                    <span style={{ color: c, fontWeight: 500, fontSize: 13 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Resolved */}
          <div
            className="rounded-md border bg-card text-card-foreground p-4 mb-4"
            style={{ padding: 0, overflow: 'hidden' }}
          >
            <div
              className="mb-3 flex items-center justify-between border-b pb-3"
              style={{ padding: '12px 16px', borderRadius: 0 }}
            >
              <span className="text-sm font-semibold">Resolved · last 30 days</span>
            </div>
            <div
              className="overflow-hidden rounded-md border"
              style={{ border: 'none', borderRadius: 0 }}
            >
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Severity</th>
                    <th>Resolved by</th>
                    <th>TTR</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedSignals.map((signal) => (
                    <tr key={signal.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{signal.id}</td>
                      <td style={{ fontSize: 13 }}>{signal.title}</td>
                      <td>{severityBadge(signal.severity)}</td>
                      <td style={{ fontSize: 12 }}>{signal.owner}</td>
                      <td style={{ fontSize: 12 }}>2h 14m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Outcomes */}
          <div className="rounded-md border bg-card text-card-foreground p-4">
            <div className="mb-3 flex items-center justify-between border-b pb-3">
              <span className="text-sm font-semibold">Outcomes · last 30 days</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  label: 'RESOLVED',
                  value: 31,
                  detail: '22 by AI · 9 by humans',
                  color: 'var(--fg-success)',
                },
                {
                  label: 'DEFERRED',
                  value: 4,
                  detail: 'awaiting product input',
                  color: 'var(--fg-warning)',
                },
                {
                  label: 'DUPLICATE / WONT FIX',
                  value: 7,
                  detail: 'closed without action',
                  color: 'var(--fg-secondary)',
                },
              ].map((item) => (
                <div key={item.label}>
                  <div
                    style={{
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 4,
                    }}
                  >
                    {item.label}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: item.color }}>
                    {item.value}
                  </div>
                  <div style={{ fontSize: 12 }}>{item.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
