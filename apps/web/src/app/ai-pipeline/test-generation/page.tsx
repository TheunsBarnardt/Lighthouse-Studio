'use client';

import { useState } from 'react';

import { PipelineStepper } from '../stepper';

interface CoverageItem {
  id: string;
  name: string;
  testCount: number;
  status: 'covered' | 'gap';
}

interface TestRun {
  id: string;
  trigger: string;
  status: 'passed' | 'failed';
  duration: string;
  when: string;
  passed: number;
  total: number;
  failed: number;
}

interface FlakyTest {
  name: string;
  failures: number;
  window: string;
  cause: string;
}

const COVERAGE: CoverageItem[] = [
  { id: 'FR-1', name: 'Contact management', testCount: 4, status: 'covered' },
  { id: 'FR-2', name: 'Deal pipeline', testCount: 6, status: 'covered' },
  { id: 'FR-3', name: 'Call notes', testCount: 3, status: 'covered' },
  { id: 'FR-4', name: 'Outlook integration', testCount: 0, status: 'gap' },
  { id: 'FR-5', name: 'Pipeline view', testCount: 5, status: 'covered' },
];

const RECENT_RUNS: TestRun[] = [
  {
    id: 'test_run_127',
    trigger: 'PR #243 · main',
    status: 'passed',
    duration: '2m 14s',
    when: '12 min ago',
    passed: 87,
    total: 87,
    failed: 0,
  },
  {
    id: 'test_run_126',
    trigger: 'main · auto',
    status: 'passed',
    duration: '2m 09s',
    when: '47 min ago',
    passed: 87,
    total: 87,
    failed: 0,
  },
  {
    id: 'test_run_125',
    trigger: 'manual · Joana',
    status: 'failed',
    duration: '1m 38s',
    when: '2 hours ago',
    passed: 86,
    total: 87,
    failed: 1,
  },
  {
    id: 'test_run_124',
    trigger: 'PR #242 · feature/outlook-sync',
    status: 'passed',
    duration: '2m 22s',
    when: '4 hours ago',
    passed: 87,
    total: 87,
    failed: 0,
  },
  {
    id: 'test_run_123',
    trigger: 'main · scheduled (nightly)',
    status: 'passed',
    duration: '2m 31s',
    when: 'Yesterday 02:00',
    passed: 87,
    total: 87,
    failed: 0,
  },
];

const FLAKY_TESTS: FlakyTest[] = [
  {
    name: 'DealKanbanPage › drag-and-drop reorders cards',
    failures: 3,
    window: 'last 14 days',
    cause: 'race condition on drag end',
  },
  {
    name: 'outlookCalendarSync › retries on 429',
    failures: 2,
    window: 'last 7 days',
    cause: 'token refresh timing',
  },
  {
    name: 'ContactsTable › virtualised scroll',
    failures: 1,
    window: 'last 30 days',
    cause: 'flaky once',
  },
];

const TREND_DATA = [
  82, 84, 83, 86, 87, 86, 88, 87, 89, 87, 88, 90, 91, 90, 92, 91, 93, 92, 94, 93, 95, 94, 95, 96,
  95, 97, 96, 98, 97, 98,
];

export default function TestGenerationPage() {
  const [runningTest, setRunningTest] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PipelineStepper active="test-gen" />

      <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-canvas)' }}>
        <div className="pg-page" style={{ maxWidth: 1400 }}>
          <div className="pg-page-header">
            <div>
              <h1 style={{ fontSize: 18 }}>Tests · Continuous</h1>
              <div className="subtitle">
                Tests run on every change. AC coverage stays in sync with the PRD as it evolves.
                Last update 12 min ago.
              </div>
            </div>
            <div className="pg-page-header-actions">
              <button className="pg-btn pg-btn-secondary pg-btn-sm">Schedules</button>
              <button className="pg-btn pg-btn-secondary pg-btn-sm">Settings</button>
              <button
                onClick={() => {
                  setRunningTest(true);
                }}
                disabled={runningTest}
                className="pg-btn pg-btn-primary pg-btn-sm"
              >
                {runningTest ? '● Running…' : '▶ Run all'}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="pg-grid pg-grid-4 pg-mb-4">
            <div className="pg-stat-card">
              <div className="pg-stat-label">Suite size</div>
              <div className="pg-stat-value">87</div>
              <div className="pg-stat-delta">42 unit · 28 component · 11 int · 6 e2e</div>
            </div>
            <div className="pg-stat-card">
              <div className="pg-stat-label">Pass rate · 30d</div>
              <div className="pg-stat-value">98.4%</div>
              <div className="pg-stat-delta pg-stat-up">+0.8% vs prior 30d</div>
            </div>
            <div className="pg-stat-card">
              <div className="pg-stat-label">AC coverage (must)</div>
              <div className="pg-stat-value">100%</div>
              <div className="pg-stat-delta pg-stat-up">5/5 must-FRs</div>
            </div>
            <div className="pg-stat-card">
              <div className="pg-stat-label">Flake rate · 30d</div>
              <div className="pg-stat-value">0.7%</div>
              <div className="pg-stat-delta pg-stat-up">−0.3% vs prior</div>
            </div>
          </div>

          {/* Main grid */}
          <div className="pg-grid pg-mb-4" style={{ gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            {/* Recent runs table */}
            <div className="pg-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div className="pg-card-header" style={{ padding: '12px 16px', borderRadius: 0 }}>
                <span className="pg-card-title">Recent runs</span>
                <span style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>
                  Auto-runs on push · PR · nightly
                </span>
              </div>
              <div className="pg-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="pg-data-table">
                  <thead>
                    <tr>
                      <th>Run</th>
                      <th>Trigger</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Pass</th>
                      <th style={{ textAlign: 'right' }}>Duration</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RECENT_RUNS.map((run) => (
                      <tr key={run.id}>
                        <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{run.id}</td>
                        <td style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
                          {run.trigger}
                        </td>
                        <td>
                          {run.status === 'passed' ? (
                            <span className="pg-badge pg-badge-success">Passed</span>
                          ) : (
                            <span className="pg-badge pg-badge-danger">Failed</span>
                          )}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontSize: 12,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {run.passed}/{run.total}
                          {run.failed > 0 && (
                            <span style={{ color: 'var(--fg-danger)', marginLeft: 4 }}>
                              ({run.failed} failed)
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
                          {run.duration}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>{run.when}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right column */}
            <div>
              {/* AC Coverage */}
              <div className="pg-card pg-mb-4">
                <div className="pg-card-header">
                  <span className="pg-card-title">AC coverage</span>
                  <span className="pg-badge pg-badge-success">100% MUST</span>
                </div>
                {COVERAGE.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        className="pg-badge pg-badge-accent"
                        style={{ fontFamily: 'monospace', fontSize: 9 }}
                      >
                        {item.id}
                      </span>
                      <span style={{ fontSize: 12 }}>{item.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                        {item.testCount}
                      </span>
                      {item.status === 'covered' ? (
                        <span className="pg-badge pg-badge-success" style={{ fontSize: 9 }}>
                          ✓
                        </span>
                      ) : (
                        <span className="pg-badge pg-badge-warning" style={{ fontSize: 9 }}>
                          ⚠
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 8 }}>
                  FR-4 awaits Outlook API integration before tests can be written.
                </div>
              </div>

              {/* Active gates */}
              <div className="pg-card">
                <div className="pg-card-header">
                  <span className="pg-card-title">Active gates</span>
                </div>
                {[
                  ['On push to main', 'Enabled', 'var(--fg-success)'],
                  ['On PR open/update', 'Enabled', 'var(--fg-success)'],
                  ['Nightly e2e', '02:00 UTC', 'var(--fg-primary)'],
                  ['Pre-deploy gate', 'Required', 'var(--fg-success)'],
                ].map(([k, v, c]) => (
                  <div key={k} className="pg-inspector-row">
                    <span className="pg-inspector-key">{k}</span>
                    <span style={{ color: c, fontWeight: 500, fontSize: 13 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Flaky tests */}
          <div className="pg-card pg-mb-4" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="pg-card-header" style={{ padding: '12px 16px', borderRadius: 0 }}>
              <span className="pg-card-title">Flaky tests · last 30 days</span>
              <span className="pg-badge pg-badge-warning">3 flagged</span>
            </div>
            <div className="pg-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="pg-data-table">
                <thead>
                  <tr>
                    <th>Test</th>
                    <th style={{ textAlign: 'right' }}>Failures</th>
                    <th>Window</th>
                    <th>Likely cause</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {FLAKY_TESTS.map((test) => (
                    <tr key={test.name}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{test.name}</td>
                      <td style={{ textAlign: 'right', fontSize: 13 }}>{test.failures}</td>
                      <td style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>{test.window}</td>
                      <td style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>{test.cause}</td>
                      <td>
                        <button className="pg-btn pg-btn-secondary pg-btn-xs">Quarantine</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Coverage trend */}
          <div className="pg-card">
            <div className="pg-card-header">
              <span className="pg-card-title">Coverage trend · 30 days</span>
            </div>
            <div
              style={{
                height: 120,
                background: 'var(--bg-canvas)',
                borderRadius: 'var(--shell-radius-sm)',
                padding: 12,
                display: 'flex',
                alignItems: 'flex-end',
                gap: 3,
              }}
            >
              {TREND_DATA.map((v, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: `${String((v - 80) * 5)}%`,
                    background: 'var(--accent-primary)',
                    borderRadius: '2px 2px 0 0',
                    opacity: 0.85,
                  }}
                  title={`${String(v)}%`}
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
              <span>Today · 98%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
