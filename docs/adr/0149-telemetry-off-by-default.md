# ADR-0149: Telemetry Off by Default

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 19 (Public SDK)

## Context

Understanding how the SDK is used in production helps the platform team prioritize improvements, identify error patterns, and understand runtime distribution. However, telemetry in third-party SDKs is a frequent source of distrust and enterprise security concerns. A decision is needed on the telemetry collection policy.

## Decision

SDK telemetry is opt-in. It is disabled by default. Customers enable it explicitly:

```typescript
const platform = createClient({ url, anonKey, telemetry: true });
```

When enabled, the SDK sends a single anonymous ping to `/api/v1/telemetry/sdk` on initialization containing:

- `event: "sdk_init"`
- `sdkVersion: "0.1.0"`
- `runtime: "browser" | "node" | "deno" | "bun" | "unknown"`

No user IDs, workspace IDs, session tokens, query content, or response data are included. The telemetry payload is documented in the SDK README and the source is auditable.

## Rationale

- **Privacy-respecting:** Many enterprises have policies prohibiting outbound telemetry from SDK dependencies without explicit approval. Opt-in avoids becoming a compliance blocker.
- **Trust:** Customers who read the SDK source can verify exactly what is sent. An opt-in policy signals that the platform team values transparency over data collection.
- **Practical:** The small number of customers who opt in still provide useful aggregate signals without requiring widespread adoption.

## Consequences

**Easier:**

- Enterprise customers can evaluate and deploy the SDK without legal review of telemetry
- SDK passes common security scanning tools that flag telemetry in dependencies

**Harder:**

- Telemetry data will be sparse, especially early; platform team has limited usage visibility
- Feature usage patterns require inferring from support tickets and customer conversations rather than instrumentation

**Alternatives considered:**

- **Opt-out (collect by default, allow disable):** More data; rejected — enterprise deployments would block the SDK; trust cost exceeds data benefit
- **No telemetry ever:** Zero friction; rejected — some customers want to help and opt-in is valuable to the platform team in the long run
