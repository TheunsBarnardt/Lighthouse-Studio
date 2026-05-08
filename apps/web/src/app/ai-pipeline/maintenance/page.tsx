'use client';

import { useState } from 'react';

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
  if (severity === 'high') return <span className="pg-badge pg-badge-danger">high</span>;
  if (severity === 'medium') return <span className="pg-badge pg-badge-warning">medium</span>;
  return <span className="pg-badge pg-badge-default">low</span>;
}

function crStatusBadge(status: CRStatus) {
  if (status === 'merged') return <span className="pg-badge pg-badge-success">Merged</span>;
  if (status === 'in-progress') return <span className="pg-badge pg-badge-info">In flight</span>;
  return <span className="pg-badge pg-badge-warning">Approval</span>;
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

      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-canvas)' }}>
        <div className="pg-page" style={{ maxWidth: 1400 }}>
          <div className="pg-page-header">
            <div>
              <h1 style={{ fontSize: 18 }}>Maintenance · Continuous</h1>
              <div className="subtitle">
                Production signals → change requests → re-deploy. The pipeline keeps running.
              </div>
            </div>
            <div className="pg-page-header-actions">
              <button className="pg-btn pg-btn-secondary pg-btn-sm">Settings</button>
              <button className="pg-btn pg-btn-secondary pg-btn-sm">Export report</button>
              <button
                onClick={() => {
                  setTriaging(true);
                }}
                disabled={triaging}
                className="pg-btn pg-btn-primary pg-btn-sm"
              >
                {triaging ? '● Triaging…' : '✦ AI triage'}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="pg-grid pg-grid-4 pg-mb-4">
            <div className="pg-stat-card">
              <div className="pg-stat-label">Open signals</div>
              <div className="pg-stat-value">{openSignals.length}</div>
              <div className="pg-stat-delta pg-stat-up">3 new today</div>
            </div>
            <div className="pg-stat-card">
              <div className="pg-stat-label">Change requests in flight</div>
              <div className="pg-stat-value">2</div>
              <div className="pg-stat-delta">1 awaiting approval</div>
            </div>
            <div className="pg-stat-card">
              <div className="pg-stat-label">MTTR · 30d</div>
              <div className="pg-stat-value">3.4h</div>
              <div className="pg-stat-delta pg-stat-up">−12% vs prior</div>
            </div>
            <div className="pg-stat-card">
              <div className="pg-stat-label">AI fix rate</div>
              <div className="pg-stat-value">89%</div>
              <div className="pg-stat-delta">last 30 days</div>
            </div>
          </div>

          {/* Signals + CRs */}
          <div className="pg-grid pg-mb-4" style={{ gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            {/* Open signals */}
            <div className="pg-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="pg-card-header" style={{ padding: '12px 16px', borderRadius: 0 }}>
                <span className="pg-card-title">Open signals</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={severityFilter}
                    onChange={(e) => {
                      setSeverityFilter(e.target.value);
                    }}
                    className="pg-btn pg-btn-secondary pg-btn-xs"
                    style={{ cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    <option value="all">All severity</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>
              <div className="pg-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="pg-data-table">
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
                        <td style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
                          {signal.source}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>
                          {signal.evidence}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>{signal.when}</td>
                        <td style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
                          {signal.owner}
                        </td>
                        <td>
                          <button className="pg-btn pg-btn-secondary pg-btn-xs">Create CR</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              {/* Change requests */}
              <div className="pg-card pg-mb-4">
                <div className="pg-card-header">
                  <span className="pg-card-title">Change requests</span>
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
                          className="pg-badge pg-badge-accent"
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
                      <div style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>
                        {cr.scope} · {cr.by} · {cr.when}
                      </div>
                    </div>
                    {crStatusBadge(cr.status)}
                  </div>
                ))}
              </div>

              {/* Signal sources */}
              <div className="pg-card">
                <div className="pg-card-header">
                  <span className="pg-card-title">Signal sources</span>
                </div>
                {[
                  ['Error tracking', 'Sentry · live', 'var(--fg-success)'],
                  ['User reports', '3 open', 'var(--fg-primary)'],
                  ['CVE feed', 'GHSA · live', 'var(--fg-success)'],
                  ['Lighthouse', 'daily', 'var(--fg-success)'],
                  ['Drift detection', 'on commit', 'var(--fg-success)'],
                  ['DB advisor', 'hourly', 'var(--fg-success)'],
                ].map(([k, v, c]) => (
                  <div key={k} className="pg-inspector-row">
                    <span className="pg-inspector-key">{k}</span>
                    <span style={{ color: c, fontWeight: 500, fontSize: 13 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Resolved */}
          <div className="pg-card pg-mb-4" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="pg-card-header" style={{ padding: '12px 16px', borderRadius: 0 }}>
              <span className="pg-card-title">Resolved · last 30 days</span>
            </div>
            <div className="pg-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="pg-data-table">
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
                      <td style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>{signal.owner}</td>
                      <td style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>2h 14m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Outcomes */}
          <div className="pg-card">
            <div className="pg-card-header">
              <span className="pg-card-title">Outcomes · last 30 days</span>
            </div>
            <div className="pg-grid pg-grid-3">
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
                  color: 'var(--fg-tertiary)',
                },
              ].map((item) => (
                <div key={item.label}>
                  <div
                    style={{
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'var(--fg-tertiary)',
                      marginBottom: 4,
                    }}
                  >
                    {item.label}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: item.color }}>
                    {item.value}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>{item.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
