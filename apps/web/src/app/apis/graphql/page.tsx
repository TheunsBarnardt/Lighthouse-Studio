const QUERIES = ['contact(id)', 'contacts(filter)', 'deal(id)', 'deals(filter, sort)', 'me'];
const MUTATIONS = [
  'createContact',
  'updateContact',
  'deleteContact',
  'updateDealStage',
  'addCallNote',
];
const SUBSCRIPTIONS = ['dealUpdated', 'contactCreated', 'callNoteAdded'];
const TYPES = ['Contact', 'Deal', 'User', 'CallNote', 'DealStage', 'PaginatedDeals'];

const QUERY_TEXT = `query GetActiveDeals($limit: Int = 10) {
  deals(
    filter: { stage: { in: [PROPOSAL, NEGOTIATION] } }
    orderBy: { updatedAt: DESC }
    limit: $limit
  ) {
    id
    title
    amount
    stage
    owner {
      name
      email
    }
    contacts {
      name
      company
    }
  }
}`;

const RESPONSE_TEXT = `{
  "data": {
    "deals": [
      {
        "id": "d2a8-7e9f-...",
        "title": "Acme renewal",
        "amount": 124000,
        "stage": "NEGOTIATION",
        "owner": {
          "name": "Marcus Acker",
          "email": "marcus@acme.com"
        },
        "contacts": [
          { "name": "Alice Schwartz", "company": "Beta Co" }
        ]
      }
    ]
  }
}`;

const codeBlockStyle: React.CSSProperties = {
  fontFamily: 'ui-monospace, monospace',
  fontSize: 12,
  background: 'var(--bg-canvas)',
  border: '1px solid var(--border-default)',
  borderRadius: 0,
  padding: '12px',
  color: 'var(--fg-primary)',
  margin: 0,
  flex: 1,
  overflowY: 'auto',
  lineHeight: 1.6,
  whiteSpace: 'pre',
};

export default function GraphQLPage() {
  return (
    <div className="pg-page" style={{ maxWidth: 1400 }}>
      <div className="pg-page-header">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fg-primary)', margin: 0 }}>
            GraphQL
          </h1>
          <div style={{ fontSize: 13, color: 'var(--fg-secondary)', marginTop: 4 }}>
            Auto-generated schema · 14 types · 8 queries · 5 mutations · 3 subscriptions
          </div>
        </div>
        <div className="pg-page-header-actions">
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Download schema (.graphql)</button>
          <button className="pg-btn pg-btn-secondary pg-btn-sm">Persisted queries</button>
          <button className="pg-btn pg-btn-primary pg-btn-sm">▶ Run query</button>
        </div>
      </div>

      <div className="pg-grid pg-grid-3" style={{ marginBottom: 16 }}>
        <div className="pg-card">
          <div className="pg-card-header">
            <div className="pg-card-title">Endpoint</div>
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
            POST https://api.acme.platform.local/graphql/v1
          </div>
        </div>
        <div className="pg-card">
          <div className="pg-card-header">
            <div className="pg-card-title">Subscriptions</div>
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
            wss://api.acme.platform.local/graphql/v1
          </div>
        </div>
        <div className="pg-card">
          <div className="pg-card-header">
            <div className="pg-card-title">Persisted queries</div>
          </div>
          <div style={{ fontSize: 13, color: 'var(--fg-primary)' }}>12 stored · 87% of traffic</div>
          <div style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginTop: 8 }}>
            Recommended for production. Reduces parse overhead.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 1fr', gap: 12, height: 560 }}>
        {/* Schema explorer */}
        <div className="pg-card" style={{ overflowY: 'auto', padding: 12 }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--fg-tertiary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            Schema
          </div>

          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--fg-tertiary)',
              textTransform: 'uppercase',
              marginTop: 12,
              marginBottom: 4,
            }}
          >
            Queries
          </div>
          <div className="pg-mono" style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
            {QUERIES.map((q) => (
              <div key={q} style={{ padding: '3px 6px', cursor: 'pointer', borderRadius: 3 }}>
                {q}
              </div>
            ))}
          </div>

          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--fg-tertiary)',
              textTransform: 'uppercase',
              marginTop: 12,
              marginBottom: 4,
            }}
          >
            Mutations
          </div>
          <div className="pg-mono" style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
            {MUTATIONS.map((m) => (
              <div key={m} style={{ padding: '3px 6px' }}>
                {m}
              </div>
            ))}
          </div>

          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--fg-tertiary)',
              textTransform: 'uppercase',
              marginTop: 12,
              marginBottom: 4,
            }}
          >
            Subscriptions
          </div>
          <div className="pg-mono" style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
            {SUBSCRIPTIONS.map((s) => (
              <div key={s} style={{ padding: '3px 6px' }}>
                {s}
              </div>
            ))}
          </div>

          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--fg-tertiary)',
              textTransform: 'uppercase',
              marginTop: 12,
              marginBottom: 4,
            }}
          >
            Types
          </div>
          <div className="pg-mono" style={{ fontSize: 12, color: 'var(--fg-secondary)' }}>
            {TYPES.map((t) => (
              <div key={t} style={{ padding: '3px 6px' }}>
                {t}
                {t === 'DealStage' && (
                  <span
                    className="pg-badge pg-badge-default"
                    style={{ fontSize: 9, marginLeft: 4 }}
                  >
                    enum
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Query editor */}
        <div
          className="pg-card"
          style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
        >
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid var(--border-default)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--fg-primary)',
              }}
            >
              Query
            </span>
            <button className="pg-btn pg-btn-primary pg-btn-xs">▶ Run</button>
          </div>
          <pre style={codeBlockStyle}>{QUERY_TEXT}</pre>
          <div
            style={{
              padding: '8px 12px',
              borderTop: '1px solid var(--border-default)',
              background: 'var(--bg-canvas)',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-tertiary)' }}>
              Variables:
            </span>
            <span
              className="pg-mono"
              style={{ fontSize: 12, marginLeft: 8 }}
            >{`{ "limit": 10 }`}</span>
          </div>
        </div>

        {/* Response panel */}
        <div
          className="pg-card"
          style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
        >
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid var(--border-default)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--fg-primary)',
              }}
            >
              Response
            </span>
            <span style={{ fontSize: 12, color: 'var(--fg-success)' }}>200 · 87ms</span>
          </div>
          <pre style={codeBlockStyle}>{RESPONSE_TEXT}</pre>
        </div>
      </div>
    </div>
  );
}
