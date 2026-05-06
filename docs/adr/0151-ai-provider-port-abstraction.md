# ADR-0151: AIProviderPort Abstraction

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 20 (AI Pipeline Foundation)

## Context

The AI Build Pipeline must support multiple AI providers: Anthropic Claude, OpenAI GPT-4/o, Azure OpenAI Service, AWS Bedrock (model garden), Ollama (local), and vLLM (self-hosted inference). Each provider has a distinct SDK, authentication mechanism, streaming protocol, token counting API, and capability surface. Some enterprise customers require all AI traffic to stay on-premises; others want to switch providers at the workspace level for cost or latency reasons.

Without a port abstraction, prompt code must branch on provider, tool-use logic must repeat for every SDK, and the test suite requires live provider credentials. A single provider-specific SDK leaking into `packages/core/` would violate the hexagonal architecture and make provider switching a rewrite.

## Decision

A `AIProviderPort` is defined in `packages/ports/ai-provider/` with the following interface:

```typescript
interface AIProviderPort {
  generate(request: GenerateRequest): Promise<Result<GenerateResponse, AppError>>;
  generateStream(request: GenerateRequest): AsyncIterable<StreamChunk>;
  countTokens(request: CountTokensRequest): Promise<Result<TokenCount, AppError>>;
  listModels(): Promise<Result<ModelDescriptor[], AppError>>;
  healthCheck(): Promise<Result<HealthStatus, AppError>>;
  capabilities(): ProviderCapabilities;
}
```

`ProviderCapabilities` is a flags object declaring what the provider supports: `supportsToolUse`, `supportsVision`, `supportsStreaming`, `supportsSystemPrompt`, `maxContextTokens`, `supportedModalities`.

Adapters are implemented as separate packages:

- `packages/adapter-ai-anthropic/` — Anthropic SDK, native tool use
- `packages/adapter-ai-openai/` — OpenAI SDK, also covers Azure OpenAI via base URL + key override
- `packages/adapter-ai-bedrock/` — AWS SDK v3, Bedrock model invocation
- `packages/adapter-ai-ollama/` — Ollama HTTP API
- `packages/adapter-ai-vllm/` — vLLM OpenAI-compatible HTTP API

Core business logic references only `AIProviderPort`. The configured adapter is injected at workspace bootstrap time.

## Consequences

**Easier:**

- Core prompts and orchestrators are provider-agnostic; no branching on provider string
- New providers (e.g., Google Vertex AI, Mistral) add a new adapter package — zero changes to core
- Tests in `packages/core/` use a mock `AIProviderPort` with no live credentials required
- Workspace-level provider configuration is a runtime concern, not a code change
- Capability flags allow the UI to surface honest limitations per provider

**Harder:**

- Provider-specific features (e.g., Anthropic extended thinking, OpenAI Realtime API) cannot be used directly from core; they require a capability flag or a port extension
- Token counting differences across providers (Anthropic uses `countTokens` endpoint; OpenAI uses tiktoken locally) must be normalized behind the port
- Streaming format differences (SSE, chunked JSON) are hidden in adapters but add implementation complexity per adapter

**Alternatives Considered:**

- **Vendor SDK directly in core:** Simpler initially; rejected — ties provider choice to code changes; violates hexagonal architecture; test isolation impossible without mocking the SDK
- **Single adapter with internal branching:** One package, switches on provider string at runtime; rejected — becomes a maintenance burden as providers evolve; a single regression test suite can't verify all providers equally; still violates the single-responsibility principle
- **LangChain or similar abstraction library:** Use an existing multi-provider library; rejected — adds a large opaque dependency; LangChain's abstraction leaks provider differences in practice; removes control over streaming, error typing, and capability flags the platform needs for the UI and cost tracking
