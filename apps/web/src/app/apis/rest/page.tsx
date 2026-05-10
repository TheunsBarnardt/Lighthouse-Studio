import { Button } from '@/components/ui/button';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface Endpoint {
  method: HttpMethod;
  path: string;
  operation: string;
  notes: string;
}

interface EndpointGroup {
  group: string;
  endpoints: Endpoint[];
}

const ENDPOINT_GROUPS: EndpointGroup[] = [
  {
    group: 'contacts',
    endpoints: [
      {
        method: 'GET',
        path: '/rest/v1/contacts',
        operation: 'List contacts',
        notes: 'Paginated. Filterable.',
      },
      { method: 'POST', path: '/rest/v1/contacts', operation: 'Create contact', notes: '' },
      { method: 'GET', path: '/rest/v1/contacts/:id', operation: 'Get contact', notes: '' },
      { method: 'PATCH', path: '/rest/v1/contacts/:id', operation: 'Update contact', notes: '' },
      { method: 'DELETE', path: '/rest/v1/contacts/:id', operation: 'Delete contact', notes: '' },
    ],
  },
  {
    group: 'deals',
    endpoints: [
      { method: 'GET', path: '/rest/v1/deals', operation: 'List deals', notes: '' },
      { method: 'POST', path: '/rest/v1/deals', operation: 'Create deal', notes: '' },
      { method: 'GET', path: '/rest/v1/deals/:id', operation: 'Get deal', notes: '' },
      { method: 'PATCH', path: '/rest/v1/deals/:id', operation: 'Update deal', notes: '' },
      { method: 'DELETE', path: '/rest/v1/deals/:id', operation: 'Delete deal', notes: '' },
    ],
  },
  {
    group: 'Functions',
    endpoints: [
      {
        method: 'POST',
        path: '/functions/v1/updateDealStage',
        operation: 'Update deal stage',
        notes: 'Triggers onDealWon if applicable',
      },
      {
        method: 'POST',
        path: '/functions/v1/searchContacts',
        operation: 'Search contacts',
        notes: '',
      },
      {
        method: 'POST',
        path: '/functions/v1/exportDealsCSV',
        operation: 'Export deals as CSV',
        notes: '',
      },
    ],
  },
];

function methodBadgeClass(method: HttpMethod): string {
  const map: Record<HttpMethod, string> = {
    GET: 'inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-mono text-sm',
    POST: 'inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary font-mono text-sm',
    PATCH:
      'inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-mono text-sm',
    DELETE:
      'inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive font-mono text-sm',
  };
  return map[method];
}

export default function RestApiPage() {
  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1280 }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>REST API</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Auto-generated from your schema Â· OpenAPI 3.1 Â· Versioned Â· 47 endpoints
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" type="button">
            Download OpenAPI
          </Button>
          <Button variant="outline" size="sm" type="button">
            Postman collection
          </Button>
          <Button size="sm" type="button">
            Try in console
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 16 }}>
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">Base URL</div>
          </div>
          <div
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 11,
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '6px 10px',
            }}
          >
            https://api.acme.platform.local/rest/v1
          </div>
        </div>
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">Auth</div>
          </div>
          <div style={{ fontSize: 13 }}>Bearer JWT (recommended) or API key</div>
          <div style={{ fontSize: 11, marginTop: 8 }}>
            JWT auto-issued by /auth/sign-in. API keys at <span>API Keys</span>.
          </div>
        </div>
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">Rate limits</div>
          </div>
          <div style={{ fontSize: 13 }}>1,000 req/min per IP</div>
          <div style={{ fontSize: 11, marginTop: 8 }}>10,000 req/min per authenticated user</div>
        </div>
      </div>

      {ENDPOINT_GROUPS.map(({ group, endpoints }) => (
        <div
          key={group}
          className="rounded-md border bg-card text-card-foreground p-4"
          style={{ marginBottom: 16 }}
        >
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">{group}</div>
          </div>
          <div className="overflow-hidden rounded-md border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Method</th>
                  <th>Path</th>
                  <th>Operation</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((ep) => (
                  <tr key={ep.path + ep.method} style={{ cursor: 'pointer' }}>
                    <td>
                      <span className={methodBadgeClass(ep.method)}>{ep.method}</span>
                    </td>
                    <td className="font-mono text-sm" style={{ fontSize: 12 }}>
                      {ep.path}
                    </td>
                    <td style={{ fontSize: 13 }}>{ep.operation}</td>
                    <td style={{ fontSize: 12 }}>{ep.notes}</td>
                    <td>
                      <Button className="" variant="ghost" type="button">
                        Try it
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <div className="text-sm font-semibold">Try it Â· GET /rest/v1/contacts</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Request
            </div>
            <pre
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 11,
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '10px 12px',
                margin: 0,
                overflowX: 'auto',
              }}
            >{`curl https://api.acme.platform.local/rest/v1/contacts \\
  -H "Authorization: Bearer eyJ..." \\
  -H "Accept: application/json" \\
  --data-urlencode "limit=10" \\
  --data-urlencode "order=created_at.desc"`}</pre>
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Response Â· 200 OK
            </div>
            <pre
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 11,
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '10px 12px',
                margin: 0,
                overflowX: 'auto',
              }}
            >{`{
  "data": [
    { "id": "c1a2-...-8f7e", "name": "Alice Schwartz", "email": "alice@beta.com", ... },
    ...
  ],
  "count": 1247,
  "page": 1
}`}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}
