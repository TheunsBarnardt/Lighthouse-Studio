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
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Realtime</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>Live connections, channels, presence</div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 24 }}>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Connections
          </div>
          <div className="text-[22px] font-semibold tabular-nums">147</div>
          <div className="mt-1 text-[11px] text-muted-foreground text-emerald-600">
            +23 vs hour ago
          </div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Channels
          </div>
          <div className="text-[22px] font-semibold tabular-nums">12</div>
          <div className="mt-1 text-[11px] text-muted-foreground">5 active</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Events / sec
          </div>
          <div className="text-[22px] font-semibold tabular-nums">42</div>
          <div className="mt-1 text-[11px] text-muted-foreground">peak 89/s</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            p95 latency
          </div>
          <div className="text-[22px] font-semibold tabular-nums">23ms</div>
          <div className="mt-1 text-[11px] text-muted-foreground text-emerald-600">
            −4ms vs week
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Active channels</div>
        </div>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th>Channel</th>
                <th>Type</th>
                <th className="tabular-nums">Subscribers</th>
                <th className="tabular-nums">Events/min</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {CHANNELS.map((ch) => (
                <tr key={ch.name}>
                  <td className="font-mono text-sm" style={{ fontSize: 11 }}>
                    {ch.name}
                  </td>
                  <td>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {ch.type}
                    </span>
                  </td>
                  <td className="tabular-nums">{ch.subscribers}</td>
                  <td className="tabular-nums">{ch.eventsPerMin}</td>
                  <td>
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Active
                    </span>
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
