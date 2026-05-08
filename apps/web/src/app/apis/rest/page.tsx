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
    GET: 'pg-badge pg-badge-success pg-mono',
    POST: 'pg-badge pg-badge-accent pg-mono',
    PATCH: 'pg-badge pg-badge-warning pg-mono',
    DELETE: 'pg-badge pg-badge-danger pg-mono',
  };
  return map[method];
}

export default function RestApiPage() {
  return (
    <div className="pg-page" style={{ maxWidth: 1280 }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            REST API
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            Auto-generated from your schema · OpenAPI 3.1 · Versioned · 47 endpoints
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Download OpenAPI</button>
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Postman collection</button>
          <button className="pg-btn pg-btn-primary pg-btn-sm">Try in console</button>
        </div>
      </div>

      <div className="pg-grid pg-grid-3" style={{ marginBottom: 16 }}>
        <div className="pg-card">
          <div className="pg-card-header">
            <div className="pg-card-title">Base URL</div>
          </div>
          <div
            style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: 11,
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-default)',
              borderRadius: 4,
              padding: '6px 10px',
              color: 'var(--fg-primary)',
            }}
          >
            https://api.acme.platform.local/rest/v1
          </div>
        </div>
        <div className="pg-card">
          <div className="pg-card-header">
            <div className="pg-card-title">Auth</div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-primary)' }}>
            Bearer JWT (recommended) or API key
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 8 }}>
            JWT auto-issued by /auth/sign-in. API keys at{' '}
            <span style={{ color: 'var(--accent-primary)' }}>API Keys</span>.
          </div>
        </div>
        <div className="pg-card">
          <div className="pg-card-header">
            <div className="pg-card-title">Rate limits</div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-primary)' }}>1,000 req/min per IP</div>
          <div style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 8 }}>
            10,000 req/min per authenticated user
          </div>
        </div>
      </div>

      {ENDPOINT_GROUPS.map(({ group, endpoints }) => (
        <div key={group} className="pg-card" style={{ marginBottom: 16 }}>
          <div className="pg-card-header">
            <div className="pg-card-title">{group}</div>
          </div>
          <div className="pg-table-wrap">
            <table className="pg-data-table">
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
                    <td className="pg-mono" style={{ fontSize: 12 }}>
                      {ep.path}
                    </td>
                    <td style={{ fontSize: 13 }}>{ep.operation}</td>
                    <td style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>{ep.notes}</td>
                    <td>
                      <button className="pg-btn pg-btn-ghost pg-btn-xs">Try it</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="pg-card">
        <div className="pg-card-header">
          <div className="pg-card-title">Try it · GET /rest/v1/contacts</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--fg-tertiary)',
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
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-default)',
                borderRadius: 4,
                padding: '10px 12px',
                color: 'var(--fg-primary)',
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
                color: 'var(--fg-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Response · 200 OK
            </div>
            <pre
              style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: 11,
                background: 'var(--bg-canvas)',
                border: '1px solid var(--border-default)',
                borderRadius: 4,
                padding: '10px 12px',
                color: 'var(--fg-primary)',
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
