# Runbook: GraphQL Introspection Disabled

**Trigger:** A workspace has introspection disabled and tools (GraphiQL, code generators, API explorers) are broken.

---

## Background

GraphQL introspection (`__schema`, `__type` queries) is **on by default** for all workspaces (see ADR-0111). Workspace admins can disable it for production deployments where schema enumeration is a security concern.

When introspection is disabled, the platform returns:

```json
{
  "errors": [
    {
      "message": "GraphQL introspection is disabled for this workspace.",
      "extensions": { "code": "INTROSPECTION_DISABLED" }
    }
  ]
}
```

---

## Common scenarios

### Scenario A: Developer tool stops working after ops disabled introspection

GraphiQL, graphql-codegen, and Apollo Studio all use introspection to discover the schema. When introspection is disabled, these tools cannot function.

**Resolution options:**

1. **Re-enable introspection** on the workspace (preferred for development/staging environments).
2. **Use a schema file**: Export the schema as SDL with `graphql get-schema` or `rover graph introspect` while introspection is temporarily enabled, then configure the tool to use the local SDL file.
3. **Use a development workspace**: Keep introspection enabled on a development workspace; disable only on production.

### Scenario B: Security team requires disabling introspection on production

This is a legitimate use case. The trade-off is documented in ADR-0111: disabling introspection is security-through-obscurity and does not replace proper authorization. Every query is still authorized.

**How to disable introspection (current mechanism — code-level config):**

The `disableIntrospection` flag is reserved in the platform but not yet surfaced in the UI. To enable it, modify the composition root where `GraphQLRequestHandler` is constructed:

> **Note:** Per-workspace configuration via the UI is future work. Until implemented, this is a deploy-time configuration change.

The `GraphQLRequestHandler` checks for introspection in `handle()` at the schema-resolution step. To disable it, the handler would need the workspace's `disableIntrospection` setting passed at request time. Work with the engineering team to add this configuration path.

---

## Checking current introspection status

To test whether introspection is currently enabled for a workspace, run:

```bash
curl -X POST https://<host>/<workspace>/<schema>/graphql \
  -H "Authorization: Bearer pkey_..." \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __schema { queryType { name } } }"}'
```

- **200 with `data.__schema`**: Introspection is enabled.
- **400 with `INTROSPECTION_DISABLED`**: Introspection is disabled.

---

## Audit trail

Every introspection request generates an audit event:

```
eventType: data_management.graphql.introspection_query
actor: <api key holder>
resource: graphql_schema/<slug>
action: introspect
outcome: success
```

Use this to identify which clients are performing introspection and how frequently, before deciding whether to disable it.

---

## Related

- ADR-0111: Introspection On by Default
- Runbook: `graphql-query-too-complex.md`
- Audit event: `data_management.graphql.introspection_query`
