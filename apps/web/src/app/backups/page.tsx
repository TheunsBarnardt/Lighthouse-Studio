'use client';

const SNAPSHOTS = [
  {
    id: 'snap_20260502_0200',
    created: '2026-05-02 02:00 UTC',
    type: 'auto · daily',
    size: '38.2 GB',
    retention: '7d retention',
    replicas: 'us-east-1, eu-west-1',
  },
  {
    id: 'snap_20260501_0200',
    created: '2026-05-01 02:00 UTC',
    type: 'auto · daily',
    size: '38.1 GB',
    retention: '7d retention',
    replicas: 'us-east-1, eu-west-1',
  },
  {
    id: 'snap_20260430_1247',
    created: '2026-04-30 12:47 UTC',
    type: 'manual · before migration',
    size: '37.9 GB',
    retention: '30d retention',
    replicas: 'us-east-1, eu-west-1',
  },
  {
    id: 'snap_20260430_0200',
    created: '2026-04-30 02:00 UTC',
    type: 'auto · daily',
    size: '37.8 GB',
    retention: '7d retention',
    replicas: 'us-east-1, eu-west-1',
  },
  {
    id: 'snap_20260429_0200',
    created: '2026-04-29 02:00 UTC',
    type: 'auto · daily',
    size: '37.7 GB',
    retention: '7d retention',
    replicas: 'us-east-1, eu-west-1',
  },
  {
    id: 'snap_20260428_0200',
    created: '2026-04-28 02:00 UTC',
    type: 'auto · daily',
    size: '37.5 GB',
    retention: '7d retention',
    replicas: 'us-east-1, eu-west-1',
  },
  {
    id: 'snap_20260501_W',
    created: '2026-04-27 02:00 UTC',
    type: 'auto · weekly',
    size: '37.2 GB',
    retention: '12w retention',
    replicas: 'us-east-1, eu-west-1, glacier',
  },
];

const DRILLS = [
  { when: '7 days ago', from: 'snap_20260424_W', duration: '14m', ok: true },
  { when: '14 days ago', from: 'snap_20260417_W', duration: '12m', ok: true },
  { when: '21 days ago', from: 'PITR · point', duration: '8m', ok: true },
];

export default function BackupsPage() {
  return (
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Backups & Recovery
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            PostgreSQL · Last backup 8 hours ago · PITR window: 7 days · Cross-region replicated
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Restore wizard</button>
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Settings</button>
          <button className="pg-btn pg-btn-primary pg-btn-sm">+ Manual snapshot</button>
        </div>
      </div>

      {/* Stats */}
      <div className="pg-grid pg-grid-4" style={{ marginBottom: 16 }}>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Last backup</div>
          <div className="pg-stat-value">8h ago</div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            02:00 UTC daily
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">PITR window</div>
          <div className="pg-stat-value">7d</div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            restore to any second
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Total snapshots</div>
          <div className="pg-stat-value">21</div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            7 daily · 12 weekly · 2 manual
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Backup storage</div>
          <div className="pg-stat-value">847 GB</div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            $8.20 / mo
          </div>
        </div>
      </div>

      {/* Backup policy */}
      <div className="pg-card" style={{ marginBottom: 16 }}>
        <div className="pg-card-header">
          <div className="pg-card-title">Backup policy</div>
        </div>
        <div className="pg-grid pg-grid-3">
          <div className="pg-inspector-row">
            <span className="pg-inspector-key">Daily snapshot</span>
            <span className="pg-inspector-val">02:00 UTC · 7d retention</span>
          </div>
          <div className="pg-inspector-row">
            <span className="pg-inspector-key">Weekly snapshot</span>
            <span className="pg-inspector-val">Sun 02:00 UTC · 12w retention</span>
          </div>
          <div className="pg-inspector-row">
            <span className="pg-inspector-key">Monthly snapshot</span>
            <span className="pg-inspector-val">1st of month · 12 months</span>
          </div>
          <div className="pg-inspector-row">
            <span className="pg-inspector-key">PITR</span>
            <span className="pg-inspector-val">WAL streaming · 7d window</span>
          </div>
          <div className="pg-inspector-row">
            <span className="pg-inspector-key">Replication</span>
            <span className="pg-inspector-val">us-east-1 · eu-west-1 · Glacier (cold)</span>
          </div>
          <div className="pg-inspector-row">
            <span className="pg-inspector-key">Encryption</span>
            <span className="pg-inspector-val">AES-256 at rest · TLS in transit</span>
          </div>
        </div>
      </div>

      {/* Snapshots table */}
      <div className="pg-card" style={{ marginBottom: 16 }}>
        <div className="pg-card-header">
          <div className="pg-card-title">Snapshots</div>
        </div>
        <div className="pg-table-wrap">
          <table className="pg-data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Created</th>
                <th>Type</th>
                <th className="pg-tabular">Size</th>
                <th>Status</th>
                <th>Retention</th>
                <th>Replicated to</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {SNAPSHOTS.map((snap) => (
                <tr key={snap.id}>
                  <td className="pg-mono" style={{ fontSize: 11 }}>
                    {snap.id}
                  </td>
                  <td style={{ fontSize: 11 }}>{snap.created}</td>
                  <td style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>{snap.type}</td>
                  <td className="pg-tabular" style={{ fontSize: 11 }}>
                    {snap.size}
                  </td>
                  <td>
                    <span className="pg-badge pg-badge-success">Completed</span>
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--fg-secondary)' }}>{snap.retention}</td>
                  <td style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>{snap.replicas}</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="pg-btn pg-btn-ghost pg-btn-xs">Download</button>
                    <button className="pg-btn pg-btn-secondary pg-btn-xs">Restore</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PITR + Drills */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="pg-card">
          <div className="pg-card-header">
            <div className="pg-card-title">Point-in-time recovery</div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginBottom: 12 }}>
            Restore to any second within the last 7 days.
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--fg-tertiary)',
              marginBottom: 4,
            }}
          >
            RECOVERY POINT
          </div>
          <input
            type="datetime-local"
            defaultValue="2026-05-01T18:00"
            style={{
              width: '100%',
              marginBottom: 12,
              height: 28,
              padding: '0 8px',
              borderRadius: 4,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-canvas)',
              color: 'var(--fg-primary)',
              fontSize: 12,
            }}
          />
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--fg-tertiary)',
              marginBottom: 4,
            }}
          >
            RESTORE TARGET
          </div>
          <select
            style={{
              width: '100%',
              marginBottom: 12,
              height: 28,
              padding: '0 8px',
              borderRadius: 4,
              border: '1px solid var(--border-default)',
              background: 'var(--bg-canvas)',
              color: 'var(--fg-primary)',
              fontSize: 12,
            }}
          >
            <option>New database (recommended)</option>
            <option>Replace primary (destructive)</option>
          </select>
          <button className="pg-btn pg-btn-primary pg-btn-sm" style={{ width: '100%' }}>
            Start restore
          </button>
        </div>

        <div className="pg-card">
          <div className="pg-card-header">
            <div className="pg-card-title">Recent restore drills</div>
          </div>
          <div className="pg-table-wrap">
            <table className="pg-data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>From</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {DRILLS.map((drill) => (
                  <tr key={drill.when}>
                    <td style={{ fontSize: 11, color: 'var(--fg-tertiary)' }}>{drill.when}</td>
                    <td className="pg-mono" style={{ fontSize: 11 }}>
                      {drill.from}
                    </td>
                    <td className="pg-tabular" style={{ fontSize: 11 }}>
                      {drill.duration}
                    </td>
                    <td>
                      <span className="pg-badge pg-badge-success">OK</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 12 }}>
            Auto-drills every 7 days verify backups can actually be restored.
          </div>
        </div>
      </div>
    </div>
  );
}
