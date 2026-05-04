# GraphQL API Guide

Every workspace schema deployed on the platform automatically receives a GraphQL API alongside its REST API. The GraphQL API exposes the same data, the same permission model, and the same audit trail as the REST API.

---

## Endpoint

```
POST https://<host>/<workspace-slug>/<schema-slug>/graphql
```

All requests require an API key in the `Authorization` header:

```bash
curl -X POST https://<host>/acme/store/graphql \
  -H "Authorization: Bearer pkey_..." \
  -H "Content-Type: application/json" \
  -d '{"query":"{ productCount }"}'
```

You can also open the **GraphQL Playground** in your browser:

```
GET https://<host>/<workspace-slug>/<schema-slug>/graphql-playground
```

The playground reads your API key from `localStorage` — set it once from the browser console:

```javascript
localStorage.setItem('pf_api_key_<workspace-slug>', 'pkey_...');
```

---

## Schema conventions

The platform generates the GraphQL schema from your table definitions automatically.

| Table (SQL name) | GraphQL type | Example query field                            |
| ---------------- | ------------ | ---------------------------------------------- |
| `products`       | `Product`    | `product`, `productList`, `productCount`       |
| `order_items`    | `OrderItem`  | `orderItem`, `orderItemList`, `orderItemCount` |

- Table names are **singularised** and converted to **PascalCase** for GraphQL types.
- Column names are **converted to camelCase** for GraphQL fields (`created_at` → `createdAt`).
- Foreign key columns produce **relationship fields** automatically (see [Relationships](#relationships)).

---

## Querying

### Get a single record

```graphql
query GetProduct($id: ID!) {
  product(id: $id) {
    id
    name
    price
    active
  }
}
```

### List with pagination

The platform uses [Relay-style cursor pagination](https://relay.dev/graphql/connections.htm):

```graphql
query ListProducts($after: String) {
  productList(first: 20, after: $after) {
    edges {
      cursor
      node {
        id
        name
        price
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

Pass `endCursor` from one response as `after` in the next request to paginate.

### Count records

```graphql
query CountActiveProducts {
  productCount(filter: { active: { _eq: true } })
}
```

### Filter

Every column gets a filter input with operators appropriate for its type:

| Operator                        | String | Number | Boolean | UUID |
| ------------------------------- | :----: | :----: | :-----: | :--: |
| `_eq` / `_neq`                  |   ✓    |   ✓    |    ✓    |  ✓   |
| `_in` / `_nin`                  |   ✓    |   ✓    |         |  ✓   |
| `_lt` / `_lte` / `_gt` / `_gte` |        |   ✓    |         |      |
| `_contains` / `_icontains`      |   ✓    |        |         |      |
| `_starts_with` / `_ends_with`   |   ✓    |        |         |      |
| `_is_null`                      |   ✓    |   ✓    |    ✓    |  ✓   |

Combine conditions with `_and`, `_or`, `_not`:

```graphql
{
  productList(filter: { _and: [{ price: { _lte: 100 } }, { active: { _eq: true } }] }) {
    edges {
      node {
        id
        name
        price
      }
    }
  }
}
```

### Sort

```graphql
{
  productList(sort: [{ price: DESC }, { name: ASC }]) {
    edges {
      node {
        id
        name
        price
      }
    }
  }
}
```

### Include archived rows

Rows with an `archived_at` column are excluded by default. Set `includeArchived: true` to include them:

```graphql
{
  productList(includeArchived: true) {
    edges {
      node {
        id
        name
        archivedAt
      }
    }
  }
}
```

---

## Mutations

All create and update mutations return a **tagged union result type**. Always check `__typename` to handle each outcome:

```graphql
mutation CreateProduct($input: CreateProductInput!) {
  createProduct(input: $input) {
    __typename

    ... on CreateProductSuccess {
      product {
        id
        name
        price
      }
    }

    ... on ValidationError {
      errors {
        field
        code
        message
      }
    }

    ... on ConflictError {
      message
      conflictingField
    }

    ... on AuthorizationError {
      message
      requiredPermission
    }
  }
}
```

### Create

```graphql
mutation {
  createProduct(input: { name: "Widget", price: 9.99 }) {
    __typename
    ... on CreateProductSuccess {
      product {
        id
      }
    }
    ... on ValidationError {
      errors {
        field
        message
      }
    }
  }
}
```

### Update (PATCH semantics — only send changed fields)

```graphql
mutation {
  updateProduct(id: "...", input: { price: 14.99 }) {
    __typename
    ... on UpdateProductSuccess {
      product {
        id
        price
      }
    }
    ... on ValidationError {
      errors {
        field
        message
      }
    }
    ... on ConflictError {
      message
    }
  }
}
```

To guard against concurrent edits, pass `expectedVersion`:

```graphql
mutation {
  updateProduct(id: "...", expectedVersion: 3, input: { price: 14.99 }) {
    __typename
    ... on UpdateProductSuccess {
      product {
        id
        version
      }
    }
    ... on ConflictError {
      message
    }
  }
}
```

### Archive / Restore / Hard Delete

```graphql
mutation {
  archiveProduct(id: "...")
}
mutation {
  restoreProduct(id: "...")
}
mutation {
  hardDeleteProduct(id: "...")
}
```

These return `Boolean!` — `true` on success.

---

## Relationships

Foreign key columns automatically produce relationship fields on both the owning and referenced types.

Given `posts.author_id → users.id`:

```graphql
{
  # To-one: posts → users
  postList(first: 5) {
    edges {
      node {
        id
        title
        users {
          # to-one FK field (named after the referenced table)
          email
        }
      }
    }
  }

  # To-many: users → posts
  userList(first: 5) {
    edges {
      node {
        id
        email
        postsList {
          # to-many FK field (named <table>List)
          edges {
            node {
              id
              title
            }
          }
        }
      }
    }
  }
}
```

Relationship fields use **DataLoader** internally — fetching a list of 100 users with their posts issues exactly 2 queries, not 101.

---

## Error format

All errors include `extensions.code` and `extensions.correlationId`:

```json
{
  "errors": [
    {
      "message": "Syntax error: Expected Name, found \"}\".",
      "extensions": {
        "code": "GRAPHQL_PARSE_FAILED",
        "correlationId": "req_01hwxyz..."
      }
    }
  ]
}
```

Common error codes:

| Code                   | HTTP status | Meaning                               |
| ---------------------- | ----------- | ------------------------------------- |
| `NOT_FOUND`            | 404         | Schema slug not found or not deployed |
| `GRAPHQL_PARSE_FAILED` | 400         | Syntax error in the query             |
| `VALIDATION_ERROR`     | 400         | Field or type validation failed       |
| `QUERY_TOO_COMPLEX`    | 400         | Query exceeds complexity limit        |
| `UNAUTHENTICATED`      | 401         | Missing or invalid API key            |
| `RATE_LIMITED`         | 429         | Request rate limit exceeded           |

---

## Limits

| Limit            | Default                         |
| ---------------- | ------------------------------- |
| Query depth      | 10 levels                       |
| Query complexity | 1000 points                     |
| Rate limit       | 500 requests/minute per API key |

Contact your workspace admin to adjust these limits.

---

## Introspection

The schema is fully introspectable — GraphiQL, graphql-codegen, and Apollo Studio work out of the box.

Workspace admins can disable introspection for production environments where schema enumeration is a concern. When disabled, `__schema` and `__type` queries return a `INTROSPECTION_DISABLED` error. All other queries continue to work normally.

**Security note:** Disabling introspection does not replace authorization — every query is still checked against your workspace's permission model regardless of whether introspection is enabled. For more detail, see [ADR-0111](../adr/0111-introspection-on-by-default.md).

---

## Schema introspection (codegen)

Generate TypeScript types for your schema using `graphql-codegen`:

```yaml
# codegen.yml
schema:
  - https://<host>/<workspace>/<schema>/graphql:
      headers:
        Authorization: 'Bearer pkey_...'
generates:
  src/generated/graphql.ts:
    plugins:
      - typescript
      - typescript-operations
```

```bash
npx graphql-codegen --config codegen.yml
```

---

## Subscriptions

Real-time subscriptions (using WebSocket) will be available in a future release. The subscription endpoint is reserved at the same URL — watch the changelog for availability.
