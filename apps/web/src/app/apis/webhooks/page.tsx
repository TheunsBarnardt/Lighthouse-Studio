import { Button } from '@/components/ui/button';

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string;
  status: 'enabled' | 'paused' | 'failing';
  successRate: string;
  lastDelivery: string;
  total: number;
}

const WEBHOOKS: Webhook[] = [
  {
    id: 'hook_4d92e3',
    name: 'Slack notifications Â· #sales',
    url: 'https://hooks.slack.com/services/T0â€¢â€¢â€¢/B0â€¢â€¢â€¢',
    events: '3 events',
    status: 'enabled',
    successRate: '99.7%',
    lastDelivery: '12 min ago',
    total: 142,
  },
  {
    id: 'hook_8e147a',
    name: 'Salesforce sync',
    url: 'https://acme.my.salesforce.com/services/apexrest/platform/webhook',
    events: '5 events',
    status: 'enabled',
    successRate: '94.2%',
    lastDelivery: '47 min ago',
    total: 1247,
  },
  {
    id: 'hook_a3f291',
    name: 'Customer.io Â· audience updates',
    url: 'https://track.customer.io/api/v1/customers/{id}',
    events: '2 events',
    status: 'enabled',
    successRate: '99.9%',
    lastDelivery: '2h ago',
    total: 847,
  },
  {
    id: 'hook_b8214c',
    name: 'Internal accounting',
    url: 'https://accounting.acme.local/webhook',
    events: '1 event',
    status: 'paused',
    successRate: 'â€”',
    lastDelivery: 'Yesterday',
    total: 12,
  },
  {
    id: 'hook_c9362d',
    name: 'Legacy CRM bridge',
    url: 'https://legacy-crm.acme.local/api/v1/sync',
    events: '4 events',
    status: 'failing',
    successRate: '12.4%',
    lastDelivery: '3 hours ago',
    total: 47,
  },
];

interface Delivery {
  when: string;
  hook: string;
  event: string;
  status: string;
  latency: string;
  attempts: string;
}

const DELIVERIES: Delivery[] = [
  {
    when: '12 min ago',
    hook: 'Slack notifications',
    event: 'deal.won',
    status: '200',
    latency: '142ms',
    attempts: '1',
  },
  {
    when: '28 min ago',
    hook: 'Salesforce sync',
    event: 'contact.updated',
    status: '200',
    latency: '847ms',
    attempts: '1',
  },
  {
    when: '47 min ago',
    hook: 'Salesforce sync',
    event: 'deal.created',
    status: '200',
    latency: '312ms',
    attempts: '1',
  },
  {
    when: '3h ago',
    hook: 'Legacy CRM bridge',
    event: 'deal.updated',
    status: '503',
    latency: '8.2s',
    attempts: '3 of 5',
  },
  {
    when: '3h ago',
    hook: 'Legacy CRM bridge',
    event: 'contact.created',
    status: '503',
    latency: '8.4s',
    attempts: '3 of 5',
  },
];

function webhookStatusBadge(status: Webhook['status']) {
  if (status === 'enabled')
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        Enabled
      </span>
    );
  if (status === 'paused')
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        Paused
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
      Failing
    </span>
  );
}

function httpStatusBadge(status: string) {
  return status.startsWith('2') ? (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
      {status}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
      {status}
    </span>
  );
}

export default function WebhooksPage() {
  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Webhooks Â· Outgoing</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Notify external systems on data changes Â· 5 hooks Â· 4 active Â· 1 paused
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" type="button">
            Templates
          </Button>
          <Button variant="outline" size="sm" type="button">
            Audit log
          </Button>
          <Button size="sm" type="button">
            + New webhook
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 16 }}>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Active hooks
          </div>
          <div className="text-[22px] font-semibold tabular-nums">4</div>
          <div className="mt-1 text-[11px] text-muted-foreground">1 paused</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Deliveries Â· 30d
          </div>
          <div className="text-[22px] font-semibold tabular-nums">2,295</div>
          <div className="mt-1 text-[11px] text-muted-foreground text-emerald-600">
            +12% vs prior
          </div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Success rate
          </div>
          <div className="text-[22px] font-semibold tabular-nums">97.2%</div>
          <div className="mt-1 text-[11px] text-muted-foreground">SLA: 99%</div>
        </div>
        <div className="rounded-md border bg-card p-4">
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
            Failing hooks
          </div>
          <div className="text-[22px] font-semibold tabular-nums">1</div>
          <div className="mt-1 text-[11px] text-muted-foreground">Legacy CRM bridge</div>
        </div>
      </div>

      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{
          background: 'oklch(0.96 0.04 25)',
          borderColor: 'var(--destructive)',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Legacy CRM bridge is failing</div>
            <div style={{ fontSize: 13 }}>
              12.4% success rate over the last 24 hours Â· 41 of 47 deliveries returned 503. Endpoint
              may be down.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 16 }}>
            <Button variant="outline" size="sm" type="button">
              View deliveries
            </Button>
            <Button variant="outline" size="sm" type="button">
              Pause
            </Button>
          </div>
        </div>
      </div>

      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ marginBottom: 16 }}
      >
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Configured webhooks</div>
        </div>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>URL</th>
                <th>Events</th>
                <th>Status</th>
                <th>Success Â· 24h</th>
                <th>Last delivery</th>
                <th className="tabular-nums">Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {WEBHOOKS.map((hook) => {
                const rateNum = parseFloat(hook.successRate);
                return (
                  <tr key={hook.id}>
                    <td className="font-mono text-sm" style={{ fontSize: 12 }}>
                      {hook.id}
                    </td>
                    <td style={{ fontWeight: 500, fontSize: 13 }}>{hook.name}</td>
                    <td
                      className="font-mono text-sm"
                      style={{
                        fontSize: 12,
                        maxWidth: 280,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {hook.url}
                    </td>
                    <td style={{ fontSize: 12 }}>{hook.events}</td>
                    <td>{webhookStatusBadge(hook.status)}</td>
                    <td
                      className="tabular-nums"
                      style={{
                        fontSize: 12,
                        color: !isNaN(rateNum) && rateNum < 90 ? 'var(--destructive)' : undefined,
                      }}
                    >
                      {hook.successRate}
                    </td>
                    <td style={{ fontSize: 12 }}>{hook.lastDelivery}</td>
                    <td className="tabular-nums">{hook.total}</td>
                    <td>
                      <Button className="" variant="ghost" type="button">
                        Logs
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div
        className="rounded-md border bg-card text-card-foreground p-4"
        style={{ marginBottom: 16 }}
      >
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Recent deliveries</div>
          <div style={{ fontSize: 12 }}>Last 50 events Â· all hooks</div>
        </div>
        <div className="overflow-hidden rounded-md border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th>When</th>
                <th>Hook</th>
                <th>Event</th>
                <th>Status</th>
                <th className="tabular-nums">Latency</th>
                <th>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {DELIVERIES.map((row, i) => (
                <tr key={i}>
                  <td style={{ fontSize: 12 }}>{row.when}</td>
                  <td style={{ fontSize: 13 }}>{row.hook}</td>
                  <td className="font-mono text-sm" style={{ fontSize: 12 }}>
                    {row.event}
                  </td>
                  <td>{httpStatusBadge(row.status)}</td>
                  <td className="tabular-nums" style={{ fontSize: 12 }}>
                    {row.latency}
                  </td>
                  <td style={{ fontSize: 12 }}>{row.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Delivery guarantees</div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>At-least-once delivery</div>
            <div style={{ fontSize: 12 }}>
              Each event is retried with exponential backoff up to 5 times.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Signed payloads</div>
            <div style={{ fontSize: 12 }}>
              All requests include an HMAC-SHA256 signature in the{' '}
              <span className="font-mono text-sm">X-Platform-Signature</span> header.
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Idempotency</div>
            <div style={{ fontSize: 12 }}>
              Each delivery has a unique ID via the{' '}
              <span className="font-mono text-sm">X-Platform-Event-Id</span> header.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
