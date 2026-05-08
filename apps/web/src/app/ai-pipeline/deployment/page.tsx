'use client';

import { useState } from 'react';

import { PipelineStepper } from '../stepper';

interface Environment {
  env: string;
  status: 'deployed' | 'deploying' | 'failed';
  version: string;
  updated: string;
  url: string;
  author: string;
  commit: string;
}

interface DeployStep {
  name: string;
  status: 'complete' | 'active' | 'pending';
  meta?: string;
}

interface DeployHistoryItem {
  version: string;
  env: string;
  sha: string;
  title: string;
  author: string;
  when: string;
  status: 'success' | 'rolled-back';
  duration: string;
}

const ENVIRONMENTS: Environment[] = [
  {
    env: 'dev',
    status: 'deployed',
    version: 'v0.1.3',
    updated: '5 min ago',
    url: 'dev.acme.example.com',
    author: 'Tom Müller',
    commit: 'a3f291c',
  },
  {
    env: 'staging',
    status: 'deployed',
    version: 'v0.1.2',
    updated: '2h ago',
    url: 'staging.acme.example.com',
    author: 'Marcus Acker',
    commit: 'b8e147a',
  },
  {
    env: 'production',
    status: 'deploying',
    version: 'v0.1.0',
    updated: '3d ago',
    url: 'app.acme.example.com',
    author: 'Joana de Klerk',
    commit: '4d92e3c',
  },
];

const DEPLOY_STEPS: DeployStep[] = [
  { name: 'Pre-flight check', status: 'complete', meta: '8s' },
  { name: 'Run tests', status: 'complete', meta: '2m 14s' },
  { name: 'Apply schema migrations', status: 'complete', meta: '1.2s · 3 applied' },
  { name: 'Deploy server functions', status: 'active', meta: 'In progress · 4 of 7' },
  { name: 'Deploy UI bundle', status: 'pending' },
  { name: 'Health check', status: 'pending' },
  { name: 'Promote', status: 'pending' },
];

const HISTORY: DeployHistoryItem[] = [
  {
    version: 'v0.1.3',
    env: 'dev',
    sha: 'a3f291c',
    title: 'Fix Kanban drag race',
    author: 'Tom Müller',
    when: '5 min ago',
    status: 'success',
    duration: '47s',
  },
  {
    version: 'v0.1.2',
    env: 'staging',
    sha: 'b8e147a',
    title: 'Add Outlook integration',
    author: 'Marcus Acker',
    when: '2 hours ago',
    status: 'success',
    duration: '1m 22s',
  },
  {
    version: 'v0.1.1',
    env: 'production',
    sha: '7c2f9eb',
    title: 'Hotfix: deal stage update',
    author: 'Joana de Klerk',
    when: 'Yesterday 18:42',
    status: 'success',
    duration: '2m 18s',
  },
  {
    version: 'v0.1.0',
    env: 'production',
    sha: '4d92e3c',
    title: 'Initial release',
    author: 'Joana de Klerk',
    when: '3 days ago',
    status: 'success',
    duration: '3m 04s',
  },
  {
    version: 'v0.0.9',
    env: 'production',
    sha: '2a14d6e',
    title: 'Beta release',
    author: 'Marcus Acker',
    when: '5 days ago',
    status: 'rolled-back',
    duration: '2m 41s',
  },
];

const FREQ_DATA = [
  1, 3, 2, 4, 2, 1, 3, 5, 4, 3, 2, 4, 6, 3, 2, 4, 5, 3, 4, 2, 5, 4, 3, 5, 4, 3, 5, 6, 4, 3,
];

export default function DeploymentPage() {
  const [aborted, setAborted] = useState(false);

  function envStatusBadge(status: Environment['status']) {
    if (status === 'deploying') return <span className="pg-badge pg-badge-info">Deploying</span>;
    if (status === 'failed') return <span className="pg-badge pg-badge-danger">Failed</span>;
    return <span className="pg-badge pg-badge-success">Live</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PipelineStepper active="deployment" />

      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-canvas)' }}>
        <div className="pg-page" style={{ maxWidth: 1400 }}>
          <div className="pg-page-header">
            <div>
              <h1 style={{ fontSize: 18 }}>Deployment · Continuous</h1>
              <div className="subtitle">
                Multi-environment promotion · 47 deployments to date · 99.2% success rate
              </div>
            </div>
            <div className="pg-page-header-actions">
              <button className="pg-btn pg-btn-secondary pg-btn-sm">Settings</button>
              <button className="pg-btn pg-btn-secondary pg-btn-sm">Audit log</button>
              <button className="pg-btn pg-btn-primary pg-btn-sm">+ Deploy</button>
            </div>
          </div>

          {/* Environment cards */}
          <div className="pg-grid pg-grid-3 pg-mb-4">
            {ENVIRONMENTS.map((env) => (
              <div key={env.env} className="pg-card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      color: 'var(--fg-tertiary)',
                    }}
                  >
                    {env.env}
                  </div>
                  {envStatusBadge(env.status)}
                </div>
                <div
                  style={{
                    fontWeight: 500,
                    fontFamily: 'monospace',
                    fontSize: 14,
                    marginBottom: 4,
                    color: 'var(--fg-primary)',
                  }}
                >
                  {env.version}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginBottom: 8 }}>
                  {env.url}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 12,
                  }}
                >
                  <div>
                    <div style={{ color: 'var(--fg-tertiary)' }}>{env.updated}</div>
                    <div style={{ color: 'var(--fg-secondary)' }}>
                      {env.author} · <span style={{ fontFamily: 'monospace' }}>{env.commit}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="pg-btn pg-btn-ghost pg-btn-xs">Logs</button>
                    {env.env !== 'production' && (
                      <button className="pg-btn pg-btn-secondary pg-btn-xs">Promote</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* In-flight + approvals */}
          <div className="pg-grid pg-mb-4" style={{ gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <div className="pg-card">
              <div className="pg-card-header">
                <span className="pg-card-title">In-flight: Production deployment</span>
                <span className="pg-badge pg-badge-info">In progress · 47%</span>
              </div>
              {/* Progress bar */}
              <div
                style={{
                  height: 6,
                  background: 'var(--bg-hover)',
                  borderRadius: 3,
                  overflow: 'hidden',
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    background: 'var(--accent-primary)',
                    width: '47%',
                    borderRadius: 3,
                  }}
                />
              </div>

              {DEPLOY_STEPS.map((step) => (
                <div
                  key={step.name}
                  style={{
                    padding: '10px 12px',
                    borderLeft: `2px solid ${step.status === 'complete' ? 'var(--fg-success)' : step.status === 'active' ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                    marginBottom: 8,
                    paddingLeft: 16,
                    background: step.status === 'active' ? 'var(--bg-info-subtle)' : 'transparent',
                    borderRadius: '0 var(--shell-radius-sm) var(--shell-radius-sm) 0',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontWeight: 500,
                      fontSize: 13,
                    }}
                  >
                    <span>{step.name}</span>
                    {step.status === 'complete' && (
                      <span style={{ color: 'var(--fg-success)', fontSize: 12 }}>✓</span>
                    )}
                    {step.status === 'active' && (
                      <span style={{ color: 'var(--accent-primary)', fontSize: 12 }}>●</span>
                    )}
                  </div>
                  {step.meta && (
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--fg-tertiary)',
                        marginTop: 2,
                        fontFamily: 'monospace',
                      }}
                    >
                      {step.meta}
                    </div>
                  )}
                </div>
              ))}

              {!aborted && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
                  <button className="pg-btn pg-btn-ghost pg-btn-sm">Pause</button>
                  <button
                    onClick={() => {
                      setAborted(true);
                    }}
                    className="pg-btn pg-btn-sm"
                    style={{ background: 'var(--fg-danger)', color: 'white', border: 'none' }}
                  >
                    Abort & rollback
                  </button>
                </div>
              )}
              {aborted && (
                <div
                  style={{
                    padding: 12,
                    background: 'var(--bg-danger-subtle)',
                    borderRadius: 'var(--shell-radius-sm)',
                    fontSize: 13,
                    color: 'var(--fg-danger)',
                    marginTop: 12,
                  }}
                >
                  Deployment aborted. Rolling back…
                </div>
              )}
            </div>

            <div>
              {/* Approvals */}
              <div className="pg-card pg-mb-4">
                <div className="pg-card-header">
                  <span className="pg-card-title">Approvals required</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginBottom: 12 }}>
                  2 of 2 approvers needed for prod deploys.
                </div>
                {[
                  { initials: 'JD', name: 'Joana de Klerk', role: 'Owner', approved: true },
                  { initials: 'MA', name: 'Marcus Acker', role: 'Architect', approved: true },
                ].map((approver) => (
                  <div
                    key={approver.initials}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}
                  >
                    <div className="pg-avatar">{approver.initials}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13 }}>{approver.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>
                        {approver.role}
                      </div>
                    </div>
                    <span className="pg-badge pg-badge-success">✓ Approved</span>
                  </div>
                ))}
              </div>

              {/* Health */}
              <div className="pg-card">
                <div className="pg-card-header">
                  <span className="pg-card-title">Health · last 7d</span>
                </div>
                {[
                  ['Uptime', '99.97%', 'var(--fg-success)'],
                  ['Failed deploys', '1 of 47', 'var(--fg-primary)'],
                  ['Avg deploy time', '2m 11s', 'var(--fg-primary)'],
                  ['Rollbacks', '0', 'var(--fg-primary)'],
                ].map(([k, v, c]) => (
                  <div key={k} className="pg-inspector-row">
                    <span className="pg-inspector-key">{k}</span>
                    <span style={{ color: c, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* History table */}
          <div className="pg-card pg-mb-4" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="pg-card-header" style={{ padding: '12px 16px', borderRadius: 0 }}>
              <span className="pg-card-title">Deployment history</span>
              <button className="pg-btn pg-btn-ghost pg-btn-sm">View all 47</button>
            </div>
            <div className="pg-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="pg-data-table">
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Env</th>
                    <th>Commit</th>
                    <th>Title</th>
                    <th>Author</th>
                    <th>When</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Duration</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {HISTORY.map((item, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{item.version}</td>
                      <td>
                        <span className="pg-badge pg-badge-default">{item.env}</span>
                      </td>
                      <td
                        style={{
                          fontFamily: 'monospace',
                          fontSize: 11,
                          color: 'var(--fg-secondary)',
                        }}
                      >
                        {item.sha}
                      </td>
                      <td style={{ fontSize: 13 }}>{item.title}</td>
                      <td style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>{item.author}</td>
                      <td style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>{item.when}</td>
                      <td>
                        {item.status === 'success' ? (
                          <span className="pg-badge pg-badge-success">Success</span>
                        ) : (
                          <span className="pg-badge pg-badge-warning">Rolled back</span>
                        )}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontSize: 12,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {item.duration}
                      </td>
                      <td>
                        <button className="pg-btn pg-btn-ghost pg-btn-xs">Re-deploy</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Frequency chart */}
          <div className="pg-card">
            <div className="pg-card-header">
              <span className="pg-card-title">Deployment frequency · 30 days</span>
            </div>
            <div
              style={{
                height: 100,
                background: 'var(--bg-canvas)',
                borderRadius: 'var(--shell-radius-sm)',
                padding: 12,
                display: 'flex',
                alignItems: 'flex-end',
                gap: 3,
              }}
            >
              {FREQ_DATA.map((v, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${String(v * 14)}%`,
                    background: 'var(--accent-primary)',
                    borderRadius: '2px 2px 0 0',
                    opacity: 0.5 + v / 12,
                  }}
                  title={`${String(v)} deploys`}
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
              <span>Today · ~3.4/day avg</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
