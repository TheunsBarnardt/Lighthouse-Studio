import { Button } from '@/components/ui/button';

interface IncomingEndpoint {
  id: string;
  source: string;
  url: string;
  triggers: string;
  events30d: number;
  status: 'live';
}

const ENDPOINTS: IncomingEndpoint[] = [
  {
    id: 'ihook_241a',
    source: 'Stripe payments',
    url: 'https://api.acme.platform.local/webhooks/in/ihook_241a',
    triggers: 'invokes processStripeEvent',
    events30d: 12,
    status: 'live',
  },
  {
    id: 'ihook_142b',
    source: 'Outlook calendar push',
    url: 'https://api.acme.platform.local/webhooks/in/ihook_142b',
    triggers: 'invokes syncCalendarEvent',
    events30d: 47,
    status: 'live',
  },
  {
    id: 'ihook_8e23c',
    source: 'GitHub deploy notifications',
    url: 'https://api.acme.platform.local/webhooks/in/ihook_8e23c',
    triggers: 'invokes recordDeployment',
    events30d: 4,
    status: 'live',
  },
];

interface RecentEvent {
  when: string;
  source: string;
  eventType: string;
  fn: string;
  status: 'success' | 'error';
  latency: string;
}

const RECENT_EVENTS: RecentEvent[] = [
  {
    when: '3 min ago',
    source: 'Outlook',
    eventType: 'calendar.event.created',
    fn: 'syncCalendarEvent',
    status: 'success',
    latency: '87ms',
  },
  {
    when: '14 min ago',
    source: 'Stripe',
    eventType: 'payment_intent.succeeded',
    fn: 'processStripeEvent',
    status: 'success',
    latency: '142ms',
  },
  {
    when: '47 min ago',
    source: 'Outlook',
    eventType: 'calendar.event.updated',
    fn: 'syncCalendarEvent',
    status: 'success',
    latency: '94ms',
  },
  {
    when: '2h ago',
    source: 'GitHub',
    eventType: 'deployment_status',
    fn: 'recordDeployment',
    status: 'success',
    latency: '42ms',
  },
];

const SECRETS = [
  { source: 'Stripe', secret: 'whsec_•••a3f2' },
  { source: 'Outlook', secret: 'whsec_•••8e14' },
  { source: 'GitHub', secret: 'whsec_•••b821' },
];

export default function IncomingWebhooksPage() {
  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Webhooks · Incoming</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Receive events from external systems · 3 endpoints · 63 events / day average
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" type="button">
            Audit log
          </Button>
          <Button size="sm" type="button">
            + New endpoint
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 16 }}>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Endpoints
          </div>
          <div className="text-[22px] font-semibold tabular-nums">3</div>
          <div className="mt-1 text-[11px] text-muted-foreground">all live</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Events · 30d
          </div>
          <div className="text-[22px] font-semibold tabular-nums">1,892</div>
          <div className="mt-1 text-[11px] text-muted-foreground text-emerald-600">
            +8% vs prior
          </div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Verification failures
          </div>
          <div className="text-[22px] font-semibold tabular-nums">0</div>
          <div className="mt-1 text-[11px] text-muted-foreground">all signatures valid</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Function errors
          </div>
          <div className="text-[22px] font-semibold tabular-nums">2</div>
          <div className="mt-1 text-[11px] text-muted-foreground">last 30 days</div>
        </div>
      </div>

      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ marginBottom: 16 }}
      >
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Configured endpoints</div>
        </div>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th>ID</th>
                <th>Source</th>
                <th>URL</th>
                <th>Triggers</th>
                <th className="tabular-nums">Events · 30d</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((ep) => (
                <tr key={ep.id}>
                  <td className="font-mono text-sm" style={{ fontSize: 12 }}>
                    {ep.id}
                  </td>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>{ep.source}</td>
                  <td
                    className="font-mono text-sm"
                    style={{
                      fontSize: 12,
                      maxWidth: 320,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ep.url}
                  </td>
                  <td className="font-mono text-sm" style={{ fontSize: 12 }}>
                    {ep.triggers}
                  </td>
                  <td className="tabular-nums">{ep.events30d}</td>
                  <td>
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Live
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <Button className="" variant="ghost" type="button">
                      Logs
                    </Button>
                    <Button className="" variant="ghost" type="button">
                      Settings
                    </Button>
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
          <div className="text-sm font-semibold">Verification</div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>Signature requirements</div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              Each endpoint requires the source to sign the request body. Unsigned or invalid
              requests are rejected with 401.
            </div>
            <pre
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 11,
                border: '1px solid var(--border-default)',
                borderRadius: 4,
                padding: '6px 10px',
                margin: 0,
              }}
            >
              X-Platform-Signature: t=1714627847,v1=5257a869e7...
            </pre>
          </div>
          <div>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>Per-source secrets</div>
            {SECRETS.map((s) => (
              <div
                key={s.source}
                className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0"
              >
                <span className="text-muted-foreground">{s.source}</span>
                <span className="font-medium font-mono text-sm">{s.secret}</span>
              </div>
            ))}
            <div style={{ fontSize: 12, marginTop: 8 }}>Rotate secrets every 90 days.</div>
          </div>
        </div>
      </div>

      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Recent events</div>
        </div>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th>When</th>
                <th>Source</th>
                <th>Event type</th>
                <th>Triggered function</th>
                <th>Status</th>
                <th className="tabular-nums">Latency</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_EVENTS.map((ev, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12 }}>{ev.when}</td>
                  <td style={{ fontSize: 13 }}>{ev.source}</td>
                  <td className="font-mono text-sm" style={{ fontSize: 12 }}>
                    {ev.eventType}
                  </td>
                  <td className="font-mono text-sm" style={{ fontSize: 12 }}>
                    {ev.fn}
                  </td>
                  <td>
                    {ev.status === 'success' ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                        Error
                      </span>
                    )}
                  </td>
                  <td className="tabular-nums" style={{ fontSize: 12 }}>
                    {ev.latency}
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
