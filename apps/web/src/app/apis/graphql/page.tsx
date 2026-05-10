import { Button } from '@/components/ui/button';

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
  border: '1px solid var(--border)',
  borderRadius: 0,
  padding: '12px',
  margin: 0,
  flex: 1,
  overflowY: 'auto',
  lineHeight: 1.6,
  whiteSpace: 'pre',
};

export default function GraphQLPage() {
  return (
    <div className="mx-auto max-w-[1440px] p-6" style={{ maxWidth: 1400 }}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>GraphQL</h1>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Auto-generated schema Â· 14 types Â· 8 queries Â· 5 mutations Â· 3 subscriptions
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" type="button">
            Download schema (.graphql)
          </Button>
          <Button variant="outline" size="sm" type="button">
            Persisted queries
          </Button>
          <Button size="sm" type="button">
            â–¶ Run query
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4" style={{ marginBottom: 16 }}>
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">Endpoint</div>
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
            POST https://api.acme.platform.local/graphql/v1
          </div>
        </div>
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">Subscriptions</div>
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
            wss://api.acme.platform.local/graphql/v1
          </div>
        </div>
        <div className="rounded-md border bg-card text-card-foreground p-4">
          <div className="mb-3 flex items-center justify-between border-b pb-3">
            <div className="text-sm font-semibold">Persisted queries</div>
          </div>
          <div style={{ fontSize: 13 }}>12 stored Â· 87% of traffic</div>
          <div style={{ fontSize: 11, marginTop: 8 }}>
            Recommended for production. Reduces parse overhead.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 1fr', gap: 12, height: 560 }}>
        {/* Schema explorer */}
        <div
          className="rounded-md border bg-card text-card-foreground p-4"
          style={{ overflowY: 'auto', padding: 12 }}
        >
          <div
            style={{
              fontSize: 11,
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
              textTransform: 'uppercase',
              marginTop: 12,
              marginBottom: 4,
            }}
          >
            Queries
          </div>
          <div className="font-mono text-sm" style={{ fontSize: 12 }}>
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
              textTransform: 'uppercase',
              marginTop: 12,
              marginBottom: 4,
            }}
          >
            Mutations
          </div>
          <div className="font-mono text-sm" style={{ fontSize: 12 }}>
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
              textTransform: 'uppercase',
              marginTop: 12,
              marginBottom: 4,
            }}
          >
            Subscriptions
          </div>
          <div className="font-mono text-sm" style={{ fontSize: 12 }}>
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
              textTransform: 'uppercase',
              marginTop: 12,
              marginBottom: 4,
            }}
          >
            Types
          </div>
          <div className="font-mono text-sm" style={{ fontSize: 12 }}>
            {TYPES.map((t) => (
              <div key={t} style={{ padding: '3px 6px' }}>
                {t}
                {t === 'DealStage' && (
                  <span
                    className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
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
          className="rounded-md border bg-card text-card-foreground p-4"
          style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
        >
          <div
            style={{
              padding: '8px 12px',
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
              }}
            >
              Query
            </span>
            <Button size="xs" type="button">
              â–¶ Run
            </Button>
          </div>
          <pre style={codeBlockStyle}>{QUERY_TEXT}</pre>
          <div
            style={{
              padding: '8px 12px',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 500 }}>Variables:</span>
            <span
              className="font-mono text-sm"
              style={{ fontSize: 12, marginLeft: 8 }}
            >{`{ "limit": 10 }`}</span>
          </div>
        </div>

        {/* Response panel */}
        <div
          className="rounded-md border bg-card text-card-foreground p-4"
          style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
        >
          <div
            style={{
              padding: '8px 12px',
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
              }}
            >
              Response
            </span>
            <span style={{ fontSize: 12 }}>200 Â· 87ms</span>
          </div>
          <pre style={codeBlockStyle}>{RESPONSE_TEXT}</pre>
        </div>
      </div>
    </div>
  );
}
