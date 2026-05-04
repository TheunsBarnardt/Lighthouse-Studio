# Runbook: GraphQL Persisted Query Management

**Status:** Feature not yet implemented (deferred per ADR-0110). This runbook is a placeholder for when persisted queries are added.

---

## What persisted queries will provide

When implemented, persisted queries will allow clients to:

1. Register a query document and receive a stable hash.
2. Send subsequent requests using only the hash (smaller payloads, CDN-cacheable GET requests).
3. Workspaces configured in "persisted-queries-only" mode will reject any request that does not use a registered hash.

---

## Current state

As of v1, all GraphQL requests must include the full `query` string. Clients sending only a hash receive:

```json
{
  "errors": [
    {
      "message": "Missing \"query\" in GraphQL request.",
      "extensions": { "code": "BAD_REQUEST" }
    }
  ]
}
```

**For Apollo Client users:** Disable APQ (Automatic Persisted Queries) in the Apollo Client configuration:

```typescript
new ApolloClient({
  link: new HttpLink({
    uri: '/<workspace>/<schema>/graphql',
    // Disable APQ — server does not support persisted queries yet
    useGETForQueries: false,
  }),
  // Do NOT add PersistedQueryLink here
});
```

---

## Future implementation checklist (for implementer)

When implementing persisted queries:

1. Create a `persisted_queries` table in the platform schema (hash, document, workspaceId, registeredBy, revokedAt).
2. Add `POST /<workspace>/<schema>/graphql/persisted-queries` endpoint for registration.
3. Add `DELETE /<workspace>/<schema>/graphql/persisted-queries/:hash` for revocation.
4. Wire `data_management.graphql.persisted_query_registered` and `data_management.graphql.persisted_query_revoked` audit events (already defined in `audit-events.ts`).
5. In `GraphQLRequestHandler`, check for `{ extensions: { persistedQuery: { sha256Hash } } }` in the request body and look up the document.
6. Add workspace setting `graphqlPersistedQueriesOnly: boolean` to block ad-hoc queries.
7. Update this runbook with operational procedures.

---

## Related

- ADR-0110: Persisted Queries as Opt-In
- Audit events: `data_management.graphql.persisted_query_registered`, `data_management.graphql.persisted_query_revoked`
