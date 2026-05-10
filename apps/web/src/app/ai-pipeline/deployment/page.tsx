'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

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
    author: 'Tom MÃ¼ller',
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
  { name: 'Apply schema migrations', status: 'complete', meta: '1.2s Â· 3 applied' },
  { name: 'Deploy server functions', status: 'active', meta: 'In progress Â· 4 of 7' },
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
    author: 'Tom MÃ¼ller',
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
    if (status === 'deploying')
      return (
        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
          Deploying
        </span>
      );
    if (status === 'failed')
      return (
        <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
          Failed
        </span>
      );
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        Live
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PipelineStepper active="deployment" />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1400 }}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h1 style={{ fontSize: 18 }}>Deployment Â· Continuous</h1>
              <div className="subtitle">
                Multi-environment promotion Â· 47 deployments to date Â· 99.2% success rate
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" type="button">
                Settings
              </Button>
              <Button variant="outline" size="sm" type="button">
                Audit log
              </Button>
              <Button size="sm" type="button">
                + Deploy
              </Button>
            </div>
          </div>

          {/* Environment cards */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            {ENVIRONMENTS.map((env) => (
              <div key={env.env} className="rounded-md border bg-card text-card-foreground p-4">
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
                  }}
                >
                  {env.version}
                </div>
                <div style={{ fontSize: 11, marginBottom: 8 }}>{env.url}</div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 12,
                  }}
                >
                  <div>
                    <div>{env.updated}</div>
                    <div>
                      {env.author} Â· <span style={{ fontFamily: 'monospace' }}>{env.commit}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button className="" variant="ghost" type="button">
                      Logs
                    </Button>
                    {env.env !== 'production' && (
                      <Button variant="outline" size="xs" type="button">
                        Promote
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* In-flight + approvals */}
          <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            <div className="rounded-md border bg-card text-card-foreground p-4">
              <div className="mb-3 flex items-center justify-between border-b pb-3">
                <span className="text-sm font-semibold">In-flight: Production deployment</span>
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  In progress Â· 47%
                </span>
              </div>
              {/* Progress bar */}
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  overflow: 'hidden',
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    background: 'var(--primary)',
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
                    borderLeft: `2px solid ${step.status === 'complete' ? 'oklch(0.40 0.14 145)' : step.status === 'active' ? 'var(--primary)' : 'var(--border)'}`,
                    marginBottom: 8,
                    paddingLeft: 16,
                    background: step.status === 'active' ? 'oklch(0.96 0.04 230)' : 'transparent',
                    borderRadius: '0 4px 4px 0',
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
                    {step.status === 'complete' && <span style={{ fontSize: 12 }}>âœ“</span>}
                    {step.status === 'active' && <span style={{ fontSize: 12 }}>â—</span>}
                  </div>
                  {step.meta && (
                    <div
                      style={{
                        fontSize: 11,
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
                  <Button variant="ghost" size="sm" type="button">
                    Pause
                  </Button>
                  <Button
                    onClick={() => {
                      setAborted(true);
                    }}
                    className=""
                    style={{ background: 'var(--destructive)', color: 'white', border: 'none' }}
                  >
                    Abort & rollback
                  </Button>
                </div>
              )}
              {aborted && (
                <div
                  style={{
                    padding: 12,
                    background: 'oklch(0.96 0.04 25)',
                    borderRadius: '4px',
                    fontSize: 13,
                    marginTop: 12,
                  }}
                >
                  Deployment aborted. Rolling backâ€¦
                </div>
              )}
            </div>

            <div>
              {/* Approvals */}
              <div className="rounded-md border bg-card text-card-foreground p-4 mb-4">
                <div className="mb-3 flex items-center justify-between border-b pb-3">
                  <span className="text-sm font-semibold">Approvals required</span>
                </div>
                <div style={{ fontSize: 13, marginBottom: 12 }}>
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
                    <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {approver.initials}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13 }}>{approver.name}</div>
                      <div style={{ fontSize: 11 }}>{approver.role}</div>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      âœ“ Approved
                    </span>
                  </div>
                ))}
              </div>

              {/* Health */}
              <div className="rounded-md border bg-card text-card-foreground p-4">
                <div className="mb-3 flex items-center justify-between border-b pb-3">
                  <span className="text-sm font-semibold">Health Â· last 7d</span>
                </div>
                {[
                  ['Uptime', '99.97%', 'oklch(0.40 0.14 145)'],
                  ['Failed deploys', '1 of 47', 'var(--foreground)'],
                  ['Avg deploy time', '2m 11s', 'var(--foreground)'],
                  ['Rollbacks', '0', 'var(--foreground)'],
                ].map(([k, v, c]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0"
                  >
                    <span className="text-muted-foreground">{k}</span>
                    <span style={{ color: c, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* History table */}
          <div
            className="rounded-md border bg-card text-card-foreground p-4 mb-4"
            style={{ padding: 0, overflow: 'hidden' }}
          >
            <div
              className="mb-3 flex items-center justify-between border-b pb-3"
              style={{ padding: '12px 16px', borderRadius: 0 }}
            >
              <span className="text-sm font-semibold">Deployment history</span>
              <Button variant="ghost" size="sm" type="button">
                View all 47
              </Button>
            </div>
            <div
              className="overflow-hidden rounded-md border"
              style={{ border: 'none', borderRadius: 0 }}
            >
              <table className="w-full border-collapse text-sm">
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
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {item.env}
                        </span>
                      </td>
                      <td
                        style={{
                          fontFamily: 'monospace',
                          fontSize: 11,
                        }}
                      >
                        {item.sha}
                      </td>
                      <td style={{ fontSize: 13 }}>{item.title}</td>
                      <td style={{ fontSize: 12 }}>{item.author}</td>
                      <td style={{ fontSize: 12 }}>{item.when}</td>
                      <td>
                        {item.status === 'success' ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            Rolled back
                          </span>
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
                        <Button className="" variant="ghost" type="button">
                          Re-deploy
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Frequency chart */}
          <div className="rounded-md border bg-card text-card-foreground p-4">
            <div className="mb-3 flex items-center justify-between border-b pb-3">
              <span className="text-sm font-semibold">Deployment frequency Â· 30 days</span>
            </div>
            <div
              style={{
                height: 100,
                borderRadius: '4px',
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
                    background: 'var(--primary)',
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
                marginTop: 8,
              }}
            >
              <span>30 days ago</span>
              <span>Today Â· ~3.4/day avg</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
