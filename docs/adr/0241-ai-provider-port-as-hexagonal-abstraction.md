# ADR-0241: AI Provider Port as Hexagonal Abstraction

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 20 (AI Pipeline Foundation)

---

## Context

The platform integrates with AI providers (Anthropic, OpenAI, AWS Bedrock) at multiple pipeline stages. Tying core business logic directly to any provider's SDK would make provider changes expensive, complicate testing, and lock the platform into one vendor's abstractions (streaming formats, error types, tool call conventions).

---

## Decision

AI provider access is mediated exclusively through `AIProviderPort` in `packages/ports/ai-provider/`. Core services import only the port; adapter packages implement it. The Anthropic adapter (`packages/adapters/aiprovider-anthropic/`) is the first implementation.

The port exposes:

- `generate(request)` — non-streaming structured output
- `generateStream(request)` — `AsyncIterable<GenerationEvent>` using a normalized event union (`text_delta | tool_call_start | tool_call_complete | done | error`)
- `countTokens(request)` — pre-flight cost estimation
- `healthCheck()`, `listModels()` — operational concerns

Provider-specific concepts (Anthropic's `tool_choice: 'any'` trick for structured output, OpenAI's function_call format) live entirely inside their respective adapters. The port sees only normalized types.

The `AICachePort` follows the same pattern: a port in the same package, with in-memory and Postgres adapters.

---

## Consequences

**What becomes easier:**

- Swapping providers (or adding fallover) requires only a new adapter, not core changes.
- Testing generation logic uses a stub adapter — no real API calls in unit tests.
- Provider-specific quirks are isolated in one place.

**What becomes harder:**

- Provider features that don't map to the port's normalized types require a port extension first, then adapter implementations. This adds a step for novel features.

---

## Alternatives Considered

- **Direct Anthropic SDK in core:** Rejected — violates hexagonal architecture, breaks test isolation.
- **Single mega-adapter for all providers:** Rejected — forces lowest-common-denominator API, loses provider-specific optimizations.
- **LangChain/LiteLLM abstraction layer:** Rejected — adds an external dependency with its own abstractions and update cycle; the port is simpler and fully owned.
