import { Button } from '@/components/ui/button';

interface ApiKey {
  name: string;
  token: string;
  scope: string;
  requests: string;
  lastUsed: string;
  createdBy: string;
  age: string;
  status: 'live' | 'test' | 'expired';
}

const KEYS: ApiKey[] = [
  {
    name: 'CRM Production · Read',
    token: 'pk_live_a1b2_•••',
    scope: 'service_role',
    requests: '142,847',
    lastUsed: '2 min ago',
    createdBy: 'Joana de Klerk',
    age: '14 days ago',
    status: 'live',
  },
  {
    name: 'CRM Production · Write',
    token: 'pk_live_3c4d_•••',
    scope: 'service_role',
    requests: '8,124',
    lastUsed: '12 min ago',
    createdBy: 'Joana de Klerk',
    age: '14 days ago',
    status: 'live',
  },
  {
    name: 'Mobile App',
    token: 'pk_live_5e6f_•••',
    scope: 'anon',
    requests: '47,321',
    lastUsed: '4 hours ago',
    createdBy: 'Tom Müller',
    age: '7 days ago',
    status: 'live',
  },
  {
    name: 'CI / Testing',
    token: 'pk_test_7g8h_•••',
    scope: 'service_role',
    requests: '1,247',
    lastUsed: 'Yesterday',
    createdBy: 'Marcus Acker',
    age: '2 days ago',
    status: 'test',
  },
  {
    name: 'Legacy import job',
    token: 'pk_test_9i0j_•••',
    scope: 'service_role',
    requests: '0',
    lastUsed: 'Never',
    createdBy: 'Tom Müller',
    age: '47 days ago',
    status: 'expired',
  },
];

interface RecentEvent {
  when: string;
  event: string;
  eventBadge: string;
  key: string;
  by: string;
  ip: string;
}

const RECENT_EVENTS: RecentEvent[] = [
  {
    when: '14 days ago',
    event: 'Created',
    eventBadge: 'success',
    key: 'CRM Production · Write',
    by: 'Joana de Klerk',
    ip: '102.65.x.x',
  },
  {
    when: '14 days ago',
    event: 'Rotated',
    eventBadge: 'warning',
    key: 'CRM Production · Write',
    by: 'Joana de Klerk',
    ip: '102.65.x.x',
  },
  {
    when: '2 days ago',
    event: 'Created',
    eventBadge: 'success',
    key: 'CI / Testing',
    by: 'Marcus Acker',
    ip: '102.65.x.x',
  },
  {
    when: '12 days ago',
    event: 'Expired',
    eventBadge: 'default',
    key: 'Legacy import job',
    by: 'system',
    ip: '—',
  },
];

function statusBadge(status: ApiKey['status']) {
  if (status === 'live')
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        Live
      </span>
    );
  if (status === 'test')
    return (
      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
        Test
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      Expired
    </span>
  );
}

function scopeBadge(scope: string) {
  if (scope === 'service_role')
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-mono text-sm">
        {scope}
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground font-mono text-sm">
      {scope}
    </span>
  );
}

function eventBadge(event: string, variant: string) {
  const cls =
    variant === 'success'
      ? 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
      : variant === 'warning'
        ? 'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        : 'inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground';
  return <span className={cls}>{event}</span>;
}

const inlineCode = (text: string) => (
  <span className="font-mono text-sm" style={{ padding: '1px 5px', borderRadius: 3, fontSize: 12 }}>
    {text}
  </span>
);

export default function ApiKeysPage() {
  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>API Keys</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Issue, scope, and rotate API keys · 5 keys · 4 active · 1 expired
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" type="button">
            Audit log
          </Button>
          <Button size="sm" type="button">
            + New API key
          </Button>
        </div>
      </div>

      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{
          background: 'var(--bg-warning-subtle)',
          borderColor: 'var(--fg-warning)',
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 13 }}>
          <strong>API keys grant access to your data.</strong> Keys with the{' '}
          {inlineCode('service_role')} scope bypass all RLS policies — use them only on trusted
          servers, never in client code. Use {inlineCode('anon')} for browser/mobile clients.
        </div>
      </div>

      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ marginBottom: 16 }}
      >
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Active keys</div>
        </div>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th>Name</th>
                <th>Token (masked)</th>
                <th>Scope</th>
                <th className="tabular-nums">Requests · 30d</th>
                <th>Last used</th>
                <th>Created by</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {KEYS.map((key) => (
                <tr key={key.token}>
                  <td style={{ fontWeight: 500 }}>{key.name}</td>
                  <td className="font-mono text-sm" style={{ fontSize: 12 }}>
                    {key.token}
                  </td>
                  <td>{scopeBadge(key.scope)}</td>
                  <td className="tabular-nums">{key.requests}</td>
                  <td style={{ fontSize: 12 }}>{key.lastUsed}</td>
                  <td style={{ fontSize: 12 }}>
                    {key.createdBy} · {key.age}
                  </td>
                  <td>{statusBadge(key.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Button className="" variant="ghost" type="button">
                        Rotate
                      </Button>
                      <Button className="" variant="ghost" type="button">
                        Revoke
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ marginBottom: 16 }}
      >
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Recommended rotation policy</div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
            <span className="text-muted-foreground">Service role keys</span>
            <span className="font-medium">Rotate every 90 days</span>
          </div>
          <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
            <span className="text-muted-foreground">Anon keys</span>
            <span className="font-medium">Rotate every 180 days</span>
          </div>
          <div className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0">
            <span className="text-muted-foreground">Test keys</span>
            <span className="font-medium">No rotation enforced</span>
          </div>
        </div>
        <div style={{ fontSize: 12, marginTop: 12 }}>
          CRM Production · Write was rotated 14 days ago. Next reminder in 76 days.
        </div>
      </div>

      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Recent key events</div>
        </div>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Key</th>
                <th>By</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_EVENTS.map((ev, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12 }}>{ev.when}</td>
                  <td>{eventBadge(ev.event, ev.eventBadge)}</td>
                  <td className="font-mono text-sm" style={{ fontSize: 12 }}>
                    {ev.key}
                  </td>
                  <td style={{ fontSize: 12 }}>{ev.by}</td>
                  <td className="font-mono text-sm" style={{ fontSize: 12 }}>
                    {ev.ip}
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
