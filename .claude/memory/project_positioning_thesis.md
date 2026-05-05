---
name: Product positioning — dev-grade alternative to vibe-coding tools
description: Lighthouse Studio's thesis is filling the gap between vibe-coding tools (FlutterFlow/Lovable/Bolt/Puck/Budibase/Claude design) and real dev workflows; vibe coding is short-term and unsustainable
type: project
originSessionId: d416ed7e-3180-4d5a-bde7-55796337c96a
---

The platform's positioning is **a dev-grade alternative** to the vibe-coding/no-code/low-code wave (FlutterFlow, Lovable, Bolt, Puck Editor, Budibase, Claude design tools). The user's thesis: vibe coding is a short-term trend that breaks at the second mile (refactor, debug, multi-dev collab, production hardening, schema evolution, real auth, observability). The platform aims to fill this gap _before_ the market realizes it exists.

Equally important: **building a schema like a CMS is not the answer either.** CMS-style schema builders handle data definitions but can't express real application logic, custom workflows, or provide escape hatches when the abstraction breaks. The Supabase-equivalent (Data Management Module) is the _foundation_, not the product — the product is what devs _build on top of it_ via the AI Build Pipeline.

**Why:** User explicitly framed this on 2026-05-04 as the gap to fill. "Vibe coding is a short term idee and not sustainable in the long run." "Building a schema like a cms is also not the answer."

**How to apply:**

- When evaluating features, integrations, or scout-surfaced ideas, ask: does this serve a _dev_ (readable code output, version control, escape hatches, testable, observable) or does it cater to a _vibe coder_ (one-shot prototype, locked-in builder, opaque generation)? Favor dev-serving features.
- Generated artifacts must be code-as-truth: editable by hand, surviving round-trips through git/PR review without re-binding to a builder.
- Abstractions need escape hatches — when the visual/AI layer can't express something, devs must be able to drop down to code without leaving the platform.
- Don't recommend ideas that look like CMS schema-builder UX, even if visually polished — that's the wrong shape.
- Competitor watch list (for idea-scout adjacency): FlutterFlow, Lovable, Bolt, Puck Editor, Budibase, Claude's design surfaces — but watched as _negative examples_ (where they fail the dev) more than positive ones.
