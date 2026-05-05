# ADR-0228: Document Parsing and Context Budget Allocation

**Status:** Accepted
**Date:** 2026-05-04
**Deciders:** solo

## Context

Reference documents uploaded to the workspace (brand voice, strategy, compliance, specs) must be inserted into AI Pipeline context windows. Two problems arise:

1. **Parsing** — documents arrive as MD, PDF, DOCX, TXT (supported), or other formats (stored but not parseable). Each format needs a different extraction path to get plain text.

2. **Budget** — a large workspace might have megabytes of documents. LLM context windows are finite and expensive. Unconstrained document injection can blow the token budget, degrade output quality (context dilution), and spike per-workspace costs.

## Decision

### Parsing

Each supported MIME type maps to a named parser:

| MIME type                                                                 | Format | Parser                                                 |
| ------------------------------------------------------------------------- | ------ | ------------------------------------------------------ |
| `text/plain`                                                              | TXT    | identity (no-op)                                       |
| `text/markdown`                                                           | MD     | strip frontmatter, keep body as-is                     |
| `application/pdf`                                                         | PDF    | `pdf-parse` library; extract text only, discard images |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | DOCX   | `mammoth` library; extract raw text, discard styles    |

Parsing runs **at upload time**, not at prompt-assembly time. The extracted plain text is stored as a separate blob at `{originalKey}.parsed.txt` and its storage key is recorded in `workspace_assets.parsed_text_key`. This means context assembly is fast (one blob read per document) and parsing failures surface immediately to the uploader.

Unsupported MIME types are stored but `parsed_text_key` is null. Pipeline stages skip them with a logged warning.

### Context budget

Each pipeline stage has a **document token budget** — the maximum number of tokens that may be consumed by workspace documents for a single generation request:

| Stage                     | Budget        |
| ------------------------- | ------------- |
| Stage 2 (PRD)             | 16 000 tokens |
| Stage 3 (Design Tokens)   | 4 000 tokens  |
| Stage 6 (UI Generation)   | 8 000 tokens  |
| Stage 7 (Code Generation) | 12 000 tokens |

Budget allocation uses a **greedy by-recency strategy**: documents are sorted by `updatedAt` descending (most recently updated first), then included until the budget is exhausted. Partial documents are truncated at the last complete sentence within budget.

The actual token count is estimated using the `@anthropic-ai/tokenizer` package's `countTokens` function before insertion.

If total parsed text for a stage's declared categories fits within budget, all documents are included. The budget is a ceiling, not a target.

Each included document is wrapped with provenance separators:

```
--- BEGIN DOCUMENT: {assetId} | {category}/{role} | updated {updatedAt} ---
{parsedText}
--- END DOCUMENT ---
```

These separators allow the AI and human reviewers to trace which document contributed which content.

### "Would change if regenerated" flag

When a generation completes, the service records the `assetVersion` of each included document (the `version` column on `workspace_assets`) in the generation's metadata as `consumedAssetVersions: Record<assetId, version>`. On subsequent visits to generation history, the platform compares stored versions against current `workspace_assets.version` — if any differ, a "would change if regenerated" indicator is shown. This check is O(N assets consumed), typically < 10 per generation.

## Consequences

### Positive

- Parsing at upload time means prompt assembly has no parsing latency
- Greedy by-recency is predictable and easy to explain to workspace admins ("your newest documents take priority")
- Token budget is per-stage, not global, so a large compliance doc doesn't eat Stage 2's PRD budget
- `consumedAssetVersions` makes the "would change" check cheap and auditable

### Negative

- Re-parsing on document update is not automatic — the service must re-run parsing when `replace` is called (not just on initial upload)
- PDF and DOCX parsing add two non-trivial dependencies (`pdf-parse`, `mammoth`); both are well-maintained but add bundle size to the core server
- Greedy by-recency can silently drop older-but-important documents when budget is tight; workspace admins must be aware

### Neutral

- Token estimation with `@anthropic-ai/tokenizer` is Anthropic-specific. For other providers (OpenAI, etc.) the estimate is approximate (within ~10%), which is acceptable for budget enforcement

## Alternatives Considered

### Option A: Parse at prompt-assembly time (lazy)

Simpler upload path; no stored parsed text. Rejected: parsing a PDF at generation time adds latency (typically 200–2000 ms), happens on the hot path, and errors surface at the worst moment. Upload-time parsing is strictly better UX.

### Option B: Fixed per-document size limit instead of stage budget

Cap each document at N characters regardless of stage. Simpler but wasteful — a stage with a large budget wastes it if it has few small documents, and a stage with a small budget might still include too many documents if each is just under the cap. The greedy budget approach is more precise.

### Option C: Priority tags on documents (admin-assigned)

Admins tag each document with a priority (high/medium/low) to control inclusion order. More control, but adds UI complexity and requires admins to actively manage priorities. Recency is a good enough default for v1; priority tags can be layered on later.

## References

- Obj 15.5 — Workspace Assets and Documents
- ADR-0226 — Workspace Assets storage layout
- ADR-0227 — AI Pipeline stage-to-asset-category bindings
- `@anthropic-ai/tokenizer` — token counting
