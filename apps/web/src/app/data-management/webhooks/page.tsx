import { Button } from '@/components/ui/button';

interface DbWebhook {
  name: string;
  table: string;
  event: string;
  url: string;
  status: 'active' | 'paused';
  lastFired: string;
}

const WEBHOOKS: DbWebhook[] = [
  {
    name: 'on_deal_stage_change',
    table: 'deals',
    event: 'UPDATE',
    url: 'https://hooks.acme.local/deal-stage',
    status: 'active',
    lastFired: '2 min ago',
  },
  {
    name: 'on_contact_created',
    table: 'contacts',
    event: 'INSERT',
    url: 'https://hooks.acme.local/contact-new',
    status: 'active',
    lastFired: '15 min ago',
  },
  {
    name: 'on_deal_won',
    table: 'deals',
    event: "UPDATE WHERE stage='won'",
    url: 'https://hooks.acme.local/deal-won',
    status: 'active',
    lastFired: '47 min ago',
  },
  {
    name: 'on_invoice_paid',
    table: 'invoices',
    event: 'INSERT, UPDATE',
    url: 'https://hooks.acme.local/invoice',
    status: 'paused',
    lastFired: '3 days ago',
  },
];

export default function WebhooksPage() {
  return (
    <div style={{ padding: '16px 24px' }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Database Webhooks</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>HTTP requests on database events</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" type="button">
            + New webhook
          </Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Table</th>
              <th>Event</th>
              <th>Endpoint</th>
              <th>Status</th>
              <th>Last fired</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {WEBHOOKS.map((hook) => (
              <tr key={hook.name}>
                <td style={{ fontSize: 13 }}>{hook.name}</td>
                <td>
                  <span className="font-mono text-sm" style={{ fontSize: 11 }}>
                    {hook.table}
                  </span>
                </td>
                <td>
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {hook.event}
                  </span>
                </td>
                <td>
                  <span
                    className="font-mono text-sm"
                    style={{
                      fontSize: 11,
                      display: 'block',
                      maxWidth: 220,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={hook.url}
                  >
                    {hook.url}
                  </span>
                </td>
                <td>
                  {hook.status === 'active' ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      active
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      paused
                    </span>
                  )}
                </td>
                <td style={{ fontSize: 12 }}>{hook.lastFired}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button className="" variant="ghost" type="button">
                      Edit
                    </Button>
                    <Button className="" variant="ghost" type="button">
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
