# ADR-0101: RFC 7807 Problem Details for API Error Responses

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

The auto-generated customer REST API will return errors for many reasons: validation failures, authorization denials, rate limiting, not-found resources, conflicts from optimistic locking. The error response format must:

- Be machine-readable (clients can `switch` on a stable type field)
- Be human-readable (developers can understand the problem without consulting docs)
- Include enough context for support to locate the request in logs
- Never leak internal details (stack traces, SQL, internal IDs other than correlation IDs)
- Be consistent across all endpoints

## Decision

Use **RFC 7807 Problem Details** (`application/problem+json`).

Every error response follows this shape:

```json
{
  "type": "https://platform.example.com/errors/validation",
  "title": "Request validation failed",
  "status": 400,
  "detail": "The 'email' field is required",
  "instance": "/api/v1/data/acme/main/users",
  "errors": [{ "field": "email", "code": "REQUIRED", "message": "Email is required" }],
  "correlationId": "abc123"
}
```

Key fields:

- `type`: URI identifying the error class; stable across versions; links to docs.
- `title`: Human-readable summary; same for all instances of the error class.
- `status`: HTTP status code (also in the HTTP response status).
- `detail`: Per-instance message explaining this specific occurrence.
- `instance`: The request path; useful for correlation with access logs.
- `errors`: Optional array of field-level details (validation errors).
- `correlationId`: Matches the platform's internal audit log entry; support can look it up.

All errors go through a centralized `ProblemDetailsFormatter` in the API layer. Service methods return `Result<T, AppError>` which the formatter maps to Problem Details. Internal error details (stack traces, database errors) are logged but never included in the response body.

The `Content-Type` header on error responses is `application/problem+json`.

## Consequences

**What becomes easier:**

- Clients can test `if (response.headers['content-type'].includes('problem+json'))` to detect errors generically.
- The `type` URL is a stable machine-readable identifier; clients can map it to error-handling logic without parsing `title` strings.
- `correlationId` enables support to find the exact request across logs, traces, and audit records with a single lookup.

**What becomes harder:**

- The platform must maintain a public documentation page for each `type` URL, or the type URLs are hollow.
- The `errors` array format is slightly non-standard (RFC 7807 doesn't define it); we use a well-established convention but it's not in the RFC itself.

## Alternatives Considered

**Custom JSON error format** (`{ error: "VALIDATION_FAILED", message: "..." }`): Simpler to implement but non-standard; every client library has to implement its own error parser.

**GraphQL-style errors** (`{ errors: [{ message, extensions }] }`): Only appropriate for GraphQL endpoints (Objective 13), not REST.

**No structured errors** (plain text or raw HTTP status): Unacceptable for a developer-facing API.

RFC 7807 is a published IETF standard with broad tooling support (OpenAPI, Postman, generated clients). The small implementation cost is justified by the interoperability benefit.
