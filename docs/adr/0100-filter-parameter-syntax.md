# ADR-0100: Filter Parameter Syntax

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

The auto-generated REST API needs a URL query parameter syntax for filtering rows. Customers and their developers will type these parameters directly in browser URLs, curl commands, and generated SDK calls. The syntax must:

- Express field + operator + value (e.g. "email equals alice@example.com")
- Support all operators the platform's Filter AST provides: `_eq`, `_neq`, `_in`, `_nin`, `_lt`, `_lte`, `_gt`, `_gte`, `_contains`, `_icontains`, `_starts_with`, `_ends_with`, `_is_null`
- Support logical combination (AND, OR, NOT)
- Be safe against injection (the filter must be parsed into the Filter AST; no raw SQL/Mongo passthrough)
- Be parseable by standard HTTP client libraries without custom encoding

## Decision

Use **bracket syntax**: `filter[field][_operator]=value`.

Examples:

```
?filter[email][_eq]=alice@example.com
?filter[age][_gte]=18
?filter[status][_in]=active,pending
?filter[notes][_icontains]=hello
?filter[deleted_at][_is_null]=true
```

Multiple conditions are ANDed by default:

```
?filter[age][_gte]=18&filter[active][_eq]=true
```

Array values (`_in`, `_nin`) use comma separation within the value string:

```
?filter[status][_in]=active,pending,trial
```

Parsing is performed by `FilterParserImpl` in `packages/core/src/services/data-management/filter-parser.ts`. The parser validates field names against the table schema and validates operator applicability per column type before constructing the Filter AST. Complexity limits: max 100 conditions per request.

## Consequences

**What becomes easier:**

- Standard URL encoding libraries (browsers, fetch, axios, qs) handle bracket-style params natively.
- The format maps directly to the Filter AST: field → column name, operator → AST operator, value → coerced scalar.
- Easy to read and debug in browser developer tools and curl output.

**What becomes harder:**

- Complex nested logic (OR conditions across multiple fields) is not expressible in flat bracket syntax. Customers needing OR must use two requests or wait for a future query endpoint.
- Comma-separated array values cannot contain commas (URL-encode the value as a workaround).

## Alternatives Considered

**RSQL** (`filter=email==alice@example.com;age>=18`): Concise but requires a custom parser; not a standard library in most languages. Harder to read at a glance.

**GraphQL-style JSON** (`filter={"email":{"_eq":"alice@example.com"}}`): Requires URL-encoding a JSON string, which is unreadable in browser address bars and error-prone in curl.

**Elasticsearch-style query DSL** (JSON body on GET requests): Non-standard use of GET bodies; breaks HTTP semantics and caching proxies.

The bracket syntax is the pragmatic choice: standard, readable, no custom parser library needed by clients.
