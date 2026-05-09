'use client';

import { Button } from '@/components/ui/button';

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
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Backups & Recovery</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            PostgreSQL · Last backup 8 hours ago · PITR window: 7 days · Cross-region replicated
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" type="button">
            Restore wizard
          </Button>
          <Button variant="outline" size="sm" type="button">
            Settings
          </Button>
          <Button size="sm" type="button">
            + Manual snapshot
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 16 }}>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Last backup
          </div>
          <div className="text-[22px] font-semibold tabular-nums">8h ago</div>
          <div className="mt-1 text-[11px] text-muted-foreground">02:00 UTC daily</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            PITR window
          </div>
          <div className="text-[22px] font-semibold tabular-nums">7d</div>
          <div className="mt-1 text-[11px] text-muted-foreground">restore to any second</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Total snapshots
          </div>
          <div className="text-[22px] font-semibold tabular-nums">21</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            7 daily · 12 weekly · 2 manual
          </div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Backup storage
          </div>
          <div className="text-[22px] font-semibold tabular-nums">847 GB</div>
          <div className="mt-1 text-[11px] text-muted-foreground">$8.20 / mo</div>
        </div>
      </div>

      {/* Backup policy */}
      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ marginBottom: 16 }}
      >
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Backup policy</div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
            <span className="text-muted-foreground">Daily snapshot</span>
            <span className="font-medium">02:00 UTC · 7d retention</span>
          </div>
          <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
            <span className="text-muted-foreground">Weekly snapshot</span>
            <span className="font-medium">Sun 02:00 UTC · 12w retention</span>
          </div>
          <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
            <span className="text-muted-foreground">Monthly snapshot</span>
            <span className="font-medium">1st of month · 12 months</span>
          </div>
          <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
            <span className="text-muted-foreground">PITR</span>
            <span className="font-medium">WAL streaming · 7d window</span>
          </div>
          <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
            <span className="text-muted-foreground">Replication</span>
            <span className="font-medium">us-east-1 · eu-west-1 · Glacier (cold)</span>
          </div>
          <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
            <span className="text-muted-foreground">Encryption</span>
            <span className="font-medium">AES-256 at rest · TLS in transit</span>
          </div>
        </div>
      </div>

      {/* Snapshots table */}
      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ marginBottom: 16 }}
      >
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Snapshots</div>
        </div>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th>ID</th>
                <th>Created</th>
                <th>Type</th>
                <th className="tabular-nums">Size</th>
                <th>Status</th>
                <th>Retention</th>
                <th>Replicated to</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {SNAPSHOTS.map((snap) => (
                <tr key={snap.id}>
                  <td className="font-mono text-sm" style={{ fontSize: 11 }}>
                    {snap.id}
                  </td>
                  <td style={{ fontSize: 11 }}>{snap.created}</td>
                  <td style={{ fontSize: 11 }}>{snap.type}</td>
                  <td className="tabular-nums" style={{ fontSize: 11 }}>
                    {snap.size}
                  </td>
                  <td>
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Completed
                    </span>
                  </td>
                  <td style={{ fontSize: 11 }}>{snap.retention}</td>
                  <td style={{ fontSize: 11 }}>{snap.replicas}</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <Button className="" variant="ghost" type="button">
                      Download
                    </Button>
                    <Button variant="outline" size="xs" type="button">
                      Restore
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PITR + Drills */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">Point-in-time recovery</div>
          </div>
          <div style={{ fontSize: 13, marginBottom: 12 }}>
            Restore to any second within the last 7 days.
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
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
              fontSize: 12,
            }}
          />
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
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
              fontSize: 12,
            }}
          >
            <option>New database (recommended)</option>
            <option>Replace primary (destructive)</option>
          </select>
          <Button size="sm" type="button" style={{ width: '100%' }}>
            Start restore
          </Button>
        </div>

        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">Recent restore drills</div>
          </div>
          <div className="overflow-hidden rounded-md border">
            <table className="w-full border-collapse text-sm">
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
                    <td style={{ fontSize: 11 }}>{drill.when}</td>
                    <td className="font-mono text-sm" style={{ fontSize: 11 }}>
                      {drill.from}
                    </td>
                    <td className="tabular-nums" style={{ fontSize: 11 }}>
                      {drill.duration}
                    </td>
                    <td>
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        OK
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, marginTop: 12 }}>
            Auto-drills every 7 days verify backups can actually be restored.
          </div>
        </div>
      </div>
    </div>
  );
}
