import { Button } from '@/components/ui/button';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface Integration {
  name: string;
  category: 'Payments' | 'Messaging' | 'Storage' | 'Office' | 'Analytics';
  status: 'connected' | 'available';
  description: string;
  logo: string;
}

const INTEGRATIONS: Integration[] = [
  {
    name: 'Stripe',
    category: 'Payments',
    status: 'connected',
    description: 'Payments · 2 webhooks active · $12.4k processed today',
    logo: '💳',
  },
  {
    name: 'SendGrid',
    category: 'Messaging',
    status: 'connected',
    description: 'Transactional email · 1.2k sent today',
    logo: '✉️',
  },
  {
    name: 'Twilio',
    category: 'Messaging',
    status: 'available',
    description: 'SMS, voice, WhatsApp',
    logo: '📱',
  },
  {
    name: 'Slack',
    category: 'Messaging',
    status: 'available',
    description: 'Notifications, slash commands',
    logo: '💬',
  },
  {
    name: 'Discord',
    category: 'Messaging',
    status: 'available',
    description: 'Webhooks for community alerts',
    logo: '🎮',
  },
  {
    name: 'Azure Blob',
    category: 'Storage',
    status: 'available',
    description: 'Alternative storage backend',
    logo: '☁️',
  },
  {
    name: 'Backblaze B2',
    category: 'Storage',
    status: 'available',
    description: 'S3-compatible cold storage',
    logo: '🗄️',
  },
  {
    name: 'Microsoft Graph',
    category: 'Office',
    status: 'available',
    description: 'Outlook, Teams, Calendar, OneDrive',
    logo: '🔷',
  },
  {
    name: 'Google Workspace',
    category: 'Office',
    status: 'available',
    description: 'Gmail, Calendar, Drive, Sheets',
    logo: '🔴',
  },
  {
    name: 'HubSpot',
    category: 'Analytics',
    status: 'available',
    description: 'CRM sync, contact lists',
    logo: '🟠',
  },
  {
    name: 'Salesforce',
    category: 'Analytics',
    status: 'available',
    description: 'CRM data sync',
    logo: '☁️',
  },
  {
    name: 'Segment',
    category: 'Analytics',
    status: 'available',
    description: 'Event tracking, user analytics',
    logo: '📊',
  },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IntegrationsPage() {
  const connected = INTEGRATIONS.filter((i) => i.status === 'connected');
  const available = INTEGRATIONS.filter((i) => i.status === 'available');

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      {/* Header */}
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Integrations</h1>
          <p style={{ fontSize: 13 }}>
            Connect external services · {connected.length} connected · {available.length} available
          </p>
        </div>
        <Button variant="outline" size="sm" type="button">
          Browse marketplace
        </Button>
      </div>

      {/* Connected */}
      {connected.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2
            style={{
              marginBottom: 12,
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            Connected
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {connected.map((i) => (
              <div
                key={i.name}
                className="rounded-md border bg-card text-card-foreground p-4"
                style={{ padding: 16 }}
              >
                <div
                  style={{
                    marginBottom: 8,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{i.logo}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{i.name}</div>
                      <div style={{ fontSize: 10 }}>{i.category}</div>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    Connected
                  </span>
                </div>
                <p style={{ marginBottom: 12, fontSize: 12 }}>{i.description}</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Button variant="outline" size="sm" type="button">
                    Configure
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    style={{ color: 'var(--fg-danger, #dc2626)' }}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Available */}
      <section>
        <h2
          style={{
            marginBottom: 12,
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          Available
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {available.map((i) => (
            <div
              key={i.name}
              className="rounded-md border bg-card text-card-foreground p-4"
              style={{
                padding: 16,
              }}
            >
              <div
                style={{
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20, opacity: 0.6 }}>{i.logo}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{i.name}</div>
                    <div style={{ fontSize: 10 }}>{i.category}</div>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  Available
                </span>
              </div>
              <p style={{ marginBottom: 12, fontSize: 12 }}>{i.description}</p>
              <Button variant="outline" size="sm" type="button">
                Connect
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
