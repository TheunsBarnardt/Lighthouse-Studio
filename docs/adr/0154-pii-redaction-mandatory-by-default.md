# ADR-0154: PII Redaction Mandatory by Default

**Status:** Accepted
**Date:** 2026-05-06
**Objective:** 20 (AI Pipeline Foundation)

## Context

The AI Build Pipeline accepts user-supplied project descriptions, schema samples, example data, and requirements documents as context for generation. In practice, users frequently paste real data — database exports, example API responses, or user-facing copy — that contains personal information: names, email addresses, phone numbers, identity numbers, addresses, health data.

When this data is forwarded to a cloud AI provider (Anthropic, OpenAI, Azure, Bedrock), it leaves the customer's infrastructure. The platform operates in regulated markets (financial services, healthcare, government) where transmission of personal data to third-party processors requires contractual agreements, explicit consent, or is prohibited outright. Even where legally permitted, the reputational and regulatory risk of inadvertent PII exposure is disproportionate to any benefit.

The platform already has a personal data registry in the compliance module (from the Data Management objective) that classifies which fields contain personal data. This registry is the natural source of truth for redaction decisions.

## Decision

PII redaction is mandatory by default for all AI provider calls. The redaction pipeline runs as a middleware step in `AIProviderPort` adapter base classes before any prompt is sent to a provider.

The personal data registry drives redaction: any value classified as a personal data category is replaced with a placeholder before transmission. The placeholder format is `<{category}_redacted>` — for example, `<email_redacted>`, `<name_redacted>`, `<health_data_redacted>`. The original value is never sent to the provider.

Opt-out is available only under two conditions, both of which must be satisfied:

1. **Explicit workspace consent:** A workspace administrator has acknowledged and accepted the data processing terms in the platform settings UI
2. **Customer-controlled credentials:** The workspace uses its own API key for the provider (not the platform's shared key), meaning the data processing agreement is between the customer and the provider directly

Self-hosted providers (Ollama, vLLM on the customer's own infrastructure) are exempt from redaction because data does not leave the customer's network.

## Consequences

**Easier:**

- Regulatory compliance is the default state, not an opt-in; customers in regulated industries do not need to audit the platform before using it
- Data breach surface area is reduced; personal data classified in the registry is systematically excluded from cloud transmission
- The platform can honestly represent to auditors that PII is not sent to third-party AI providers in the default configuration

**Harder:**

- Redaction changes prompt content; prompts that use real names or emails as examples will have them replaced, which may affect generation quality for some edge cases (e.g., generating personalized copy from example data)
- The personal data registry must be populated accurately for redaction to be effective; an unclassified field passes through unredacted; this is a registry quality concern, not a platform design flaw
- Opt-out requires user-facing UI for consent and credential entry; this is additional surface area in the settings module

**Alternatives Considered:**

- **Opt-in redaction:** Redaction available but disabled by default; rejected — enterprises in regulated markets would need to audit and configure the platform before use; default-off safety features are typically disabled and forgotten; the risk is asymmetric
- **Heuristic PII detection (regex patterns, NLP):** Detect PII in prompt text using pattern matching rather than the registry; rejected — high false-positive rate disrupts legitimate use (a project description mentioning "user email" as a concept would be redacted); the registry approach is explicit and auditable
- **Block all personal data categories from AI input entirely:** Refuse to process any input that contains classified fields; rejected — too restrictive; customers frequently need to provide schema examples with sample data to get useful generation; redaction preserves utility while removing risk
