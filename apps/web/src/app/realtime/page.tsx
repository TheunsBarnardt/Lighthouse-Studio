'use client';

const CHANNELS = [
  { name: 'postgres_changes:public:deals', type: 'Database', subscribers: 42, eventsPerMin: 18 },
  { name: 'postgres_changes:public:contacts', type: 'Database', subscribers: 37, eventsPerMin: 12 },
  { name: 'presence:deal-room-001', type: 'Presence', subscribers: 8, eventsPerMin: 4 },
  { name: 'broadcast:notifications', type: 'Broadcast', subscribers: 147, eventsPerMin: 8 },
];

export default function RealtimePage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            Realtime
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            Live connections, channels, presence
          </div>
        </div>
      </div>

      <div className="pg-grid pg-grid-4" style={{ marginBottom: 24 }}>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Connections</div>
          <div className="pg-stat-value">147</div>
          <div className="pg-stat-delta pg-stat-up">+23 vs hour ago</div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Channels</div>
          <div className="pg-stat-value">12</div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            5 active
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">Events / sec</div>
          <div className="pg-stat-value">42</div>
          <div className="pg-stat-delta" style={{ color: 'var(--fg-secondary)' }}>
            peak 89/s
          </div>
        </div>
        <div className="pg-stat-card">
          <div className="pg-stat-label">p95 latency</div>
          <div className="pg-stat-value">23ms</div>
          <div className="pg-stat-delta pg-stat-up">−4ms vs week</div>
        </div>
      </div>

      <div className="pg-card">
        <div className="pg-card-header">
          <div className="pg-card-title">Active channels</div>
        </div>
        <div className="pg-table-wrap">
          <table className="pg-data-table">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Type</th>
                <th className="pg-tabular">Subscribers</th>
                <th className="pg-tabular">Events/min</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {CHANNELS.map((ch) => (
                <tr key={ch.name}>
                  <td className="pg-mono" style={{ fontSize: 11 }}>
                    {ch.name}
                  </td>
                  <td>
                    <span className="pg-badge pg-badge-default">{ch.type}</span>
                  </td>
                  <td className="pg-tabular">{ch.subscribers}</td>
                  <td className="pg-tabular">{ch.eventsPerMin}</td>
                  <td>
                    <span className="pg-badge pg-badge-success">Active</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
