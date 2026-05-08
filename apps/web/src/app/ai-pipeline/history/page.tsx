'use client';

import { useState } from 'react';

interface GenerationCall {
  id: string;
  stage: string;
  artifact: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  when: string;
  outcome: 'Approved' | 'Rejected' | 'Auto-merged' | 'Pending';
  by: string;
}

const MOCK_CALLS: GenerationCall[] = [
  {
    id: 'gen_a3f291c',
    stage: 'Stage 6 · UI gen',
    artifact: 'DealKanbanPage',
    model: 'opus-4.7',
    inputTokens: 18412,
    outputTokens: 6247,
    cost: 0.087,
    when: '12 min ago',
    outcome: 'Approved',
    by: 'Marcus Acker',
  },
  {
    id: 'gen_b8e147a',
    stage: 'Stage 7 · Code gen',
    artifact: 'updateDealStage function',
    model: 'sonnet-4.6',
    inputTokens: 8421,
    outputTokens: 1872,
    cost: 0.038,
    when: '47 min ago',
    outcome: 'Approved',
    by: 'Tom Müller',
  },
  {
    id: 'gen_4d92e3c',
    stage: 'Stage 4 · Schema synthesis',
    artifact: 'Initial schema · 21 tables',
    model: 'sonnet-4.6',
    inputTokens: 12047,
    outputTokens: 8924,
    cost: 0.078,
    when: '2h ago',
    outcome: 'Approved',
    by: 'Joana, Marcus',
  },
  {
    id: 'gen_7c2f9eb',
    stage: 'Stage 6 · UI gen',
    artifact: 'ContactsTable v2',
    model: 'opus-4.7',
    inputTokens: 14782,
    outputTokens: 5421,
    cost: 0.072,
    when: '4h ago',
    outcome: 'Rejected',
    by: 'Joana de Klerk',
  },
  {
    id: 'gen_2a14d6e',
    stage: 'Stage 6 · UI gen',
    artifact: 'ContactsTable v3',
    model: 'opus-4.7',
    inputTokens: 19204,
    outputTokens: 6892,
    cost: 0.094,
    when: '3h ago',
    outcome: 'Approved',
    by: 'Joana de Klerk',
  },
  {
    id: 'gen_5b29f8d',
    stage: 'Stage 2 · PRD',
    artifact: 'FR-1 through FR-5 expansion',
    model: 'sonnet-4.6',
    inputTokens: 4287,
    outputTokens: 2841,
    cost: 0.024,
    when: 'Yesterday',
    outcome: 'Approved',
    by: 'Joana de Klerk',
  },
  {
    id: 'gen_8f37a2e',
    stage: 'Stage 10 · Maintenance',
    artifact: 'Auto-fix CR for SIG-122',
    model: 'sonnet-4.6',
    inputTokens: 3142,
    outputTokens: 1247,
    cost: 0.014,
    when: 'Yesterday',
    outcome: 'Auto-merged',
    by: 'AI',
  },
  {
    id: 'gen_1e84b6c',
    stage: 'Stage 3 · Tokens',
    artifact: 'Brand-derived tokens v2',
    model: 'sonnet-4.6',
    inputTokens: 2147,
    outputTokens: 4214,
    cost: 0.027,
    when: '2 days ago',
    outcome: 'Approved',
    by: 'Joana de Klerk',
  },
];

function outcomeBadge(outcome: GenerationCall['outcome']) {
  if (outcome === 'Approved' || outcome === 'Auto-merged') {
    return <span className="pg-badge pg-badge-success">{outcome}</span>;
  }
  if (outcome === 'Rejected') {
    return <span className="pg-badge pg-badge-danger">Rejected</span>;
  }
  return <span className="pg-badge pg-badge-warning">Pending</span>;
}

export default function GenerationHistoryPage() {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [outcomeFilter, setOutcomeFilter] = useState('all');

  const filtered = MOCK_CALLS.filter((c) => {
    const matchesSearch =
      !search || c.artifact.toLowerCase().includes(search.toLowerCase()) || c.id.includes(search);
    const matchesStage = stageFilter === 'all' || c.stage.includes(stageFilter);
    const matchesOutcome = outcomeFilter === 'all' || c.outcome === outcomeFilter;
    return matchesSearch && matchesStage && matchesOutcome;
  });

  return (
    <div className="pg-page" style={{ maxWidth: 1400 }}>
      <div className="pg-page-header">
        <div>
          <h1>Generation History</h1>
          <div className="subtitle">
            Every AI call · prompts · outputs · cost · approval · 412 generations across all
            projects
          </div>
        </div>
        <div className="pg-page-header-actions">
          <input
            className="pg-btn pg-btn-secondary"
            placeholder="Search generations..."
            style={{
              width: 240,
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              cursor: 'text',
              fontFamily: 'inherit',
              fontSize: 12,
            }}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
          />
          <select
            className="pg-btn pg-btn-secondary pg-btn-sm"
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
            }}
            style={{ cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <option value="all">All stages</option>
            <option value="UI gen">UI gen</option>
            <option value="Code gen">Code gen</option>
            <option value="Schema">Schema synthesis</option>
            <option value="PRD">Requirements (PRD)</option>
            <option value="Tokens">Design tokens</option>
            <option value="Maintenance">Maintenance</option>
          </select>
          <select
            className="pg-btn pg-btn-secondary pg-btn-sm"
            value={outcomeFilter}
            onChange={(e) => {
              setOutcomeFilter(e.target.value);
            }}
            style={{ cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <option value="all">All outcomes</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Auto-merged">Auto-merged</option>
            <option value="Pending">Pending</option>
          </select>
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Export</button>
        </div>
      </div>

      {/* Stats */}
      <div className="pg-grid pg-grid-4 pg-mb-4">
        <div className="pg-stat-card">
          <div className="pg-stat-label">Total generations · 30d</div>
          <div className="pg-stat-value">412</div>
          <div className="pg-stat-delta">~14/day avg</div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Approval rate</div>
          <div className="pg-stat-value" style={{ color: 'var(--fg-success)' }}>
            87%
          </div>
          <div className="pg-stat-delta">8% rejected · 5% pending</div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Total cost · 30d</div>
          <div className="pg-stat-value">$23.40</div>
          <div className="pg-stat-delta">$0.057 avg per call</div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Avg time-to-approve</div>
          <div className="pg-stat-value">1h 47m</div>
          <div className="pg-stat-delta pg-stat-up">−12m vs prior</div>
        </div>
      </div>

      {/* Table */}
      <div className="pg-card pg-mb-4" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="pg-card-header" style={{ padding: '12px 16px', borderRadius: 0 }}>
          <span className="pg-card-title">Recent generations</span>
          <span style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>
            Click any row to see prompt, output, and reasoning
          </span>
        </div>
        <div className="pg-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table className="pg-data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Stage</th>
                <th>Artifact</th>
                <th>Model</th>
                <th style={{ textAlign: 'right' }}>Input</th>
                <th style={{ textAlign: 'right' }}>Output</th>
                <th style={{ textAlign: 'right' }}>Cost</th>
                <th>When</th>
                <th>Outcome</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((call) => (
                <tr key={call.id} style={{ cursor: 'pointer' }}>
                  <td
                    style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--fg-secondary)' }}
                  >
                    {call.id}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>{call.stage}</td>
                  <td style={{ fontSize: 13 }}>{call.artifact}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{call.model}</td>
                  <td
                    style={{ textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {call.inputTokens.toLocaleString()}
                  </td>
                  <td
                    style={{ textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {call.outputTokens.toLocaleString()}
                  </td>
                  <td
                    style={{ textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
                  >
                    ${call.cost.toFixed(3)}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>{call.when}</td>
                  <td>{outcomeBadge(call.outcome)}</td>
                  <td style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>{call.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom analytics */}
      <div className="pg-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Token usage by model */}
        <div className="pg-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="pg-card-header" style={{ padding: '12px 16px', borderRadius: 0 }}>
            <span className="pg-card-title">Token usage by model · 30d</span>
          </div>
          <div className="pg-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="pg-data-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th style={{ textAlign: 'right' }}>Calls</th>
                  <th style={{ textAlign: 'right' }}>Input tokens</th>
                  <th style={{ textAlign: 'right' }}>Output tokens</th>
                  <th style={{ textAlign: 'right' }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>opus-4.7</td>
                  <td style={{ textAlign: 'right', fontSize: 12 }}>147</td>
                  <td style={{ textAlign: 'right', fontSize: 12 }}>1.8M</td>
                  <td style={{ textAlign: 'right', fontSize: 12 }}>847K</td>
                  <td style={{ textAlign: 'right', fontSize: 12 }}>$14.80</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>sonnet-4.6</td>
                  <td style={{ textAlign: 'right', fontSize: 12 }}>231</td>
                  <td style={{ textAlign: 'right', fontSize: 12 }}>2.4M</td>
                  <td style={{ textAlign: 'right', fontSize: 12 }}>1.4M</td>
                  <td style={{ textAlign: 'right', fontSize: 12 }}>$7.60</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>haiku-4.5</td>
                  <td style={{ textAlign: 'right', fontSize: 12 }}>34</td>
                  <td style={{ textAlign: 'right', fontSize: 12 }}>42K</td>
                  <td style={{ textAlign: 'right', fontSize: 12 }}>12K</td>
                  <td style={{ textAlign: 'right', fontSize: 12 }}>$1.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Outcomes */}
        <div className="pg-card">
          <div className="pg-card-header">
            <span className="pg-card-title">Outcomes</span>
          </div>
          <div className="pg-grid pg-grid-3" style={{ marginBottom: 16 }}>
            <div>
              <div
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--fg-tertiary)',
                  marginBottom: 4,
                }}
              >
                APPROVED
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--fg-success)' }}>358</div>
              <div style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>87%</div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--fg-tertiary)',
                  marginBottom: 4,
                }}
              >
                REJECTED
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--fg-danger)' }}>33</div>
              <div style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>8%</div>
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--fg-tertiary)',
                  marginBottom: 4,
                }}
              >
                PENDING
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, color: 'var(--fg-warning)' }}>21</div>
              <div style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>5%</div>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>
            Rejected calls feed back as learning signal. The next generation in the same
            conversation incorporates rejection notes.
          </p>
        </div>
      </div>
    </div>
  );
}
