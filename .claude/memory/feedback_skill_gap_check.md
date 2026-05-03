---
name: Proactively scan new objectives for skill gaps
description: Before/during work on any objective, check whether existing skills cover the work; if a recurring pattern is missing, propose a new skill before plowing into implementation.
type: feedback
originSessionId: 07882865-3e79-446d-a02b-657d6f558e5a
---

When starting work on any objective in `objectives/`, do not jump straight into implementation. First scan for skill gaps.

**Why:** The user has 22 objectives remaining (as of 2026-05-03) across multi-database adapters, AI pipeline stages (20-30), UI surfaces, and infrastructure. Repeated patterns — conformance testing, prompt authoring, UI/Storybook scaffolding, code generation, sandbox validation — recur across many objectives. A skill written once saves work on every subsequent objective that touches the same pattern. Without this check, the same boilerplate analysis gets reinvented 5+ times. The user explicitly asked for this pattern: "always look at new objectives and make sure you are not missing skills to complete the job better and faster with more accuracy."

**How to apply:**

1. **Read the objective document fully before any code** — locked decisions, Definition of Done, ADRs to write, anti-patterns. Use the `objective-verifier` skill.

2. **Scan for recurring patterns** that aren't covered by existing skills in `.claude/skills/`. Signals that a new skill is warranted:

   - The objective requires a structured checklist that recurs across objectives (e.g., "every prompt needs reasoning capture, cost estimate, multi-provider tests")
   - The objective involves a repeatable validation that can be mechanized (e.g., "every UI component needs a Storybook story + a11y check + theme test")
   - The objective produces artifacts with a fixed shape (e.g., conformance test suites, sandbox manifests, capability matrix entries)
   - The work touches files where skipping a step is a security or correctness bug (the canonical shape pattern)

3. **Propose the skill BEFORE implementation, not after.** Phrasing: "Before I start Objective N, I notice we'd reuse a checker for X across this and objectives M, P. Worth building a skill first? It'd take ~10 min and save time across the rest." Get a yes/no, then proceed.

4. **Skip the proposal when:**

   - The pattern is genuinely one-off (only this objective uses it)
   - An existing skill already covers it (check `.claude/skills/` first)
   - The proposed skill is just wrapping a single command that's faster to type than to invoke

5. **Build skills incrementally.** Don't try to anticipate skills for objectives 22-30 all at once. Build the skill when the next objective needs it, so the design is grounded in real use.

6. **Existing skills as of 2026-05-03:** `objective-verifier`, `service-shape-check`, `adr-writer`. Update `project_skills.md` whenever a new one is added.

The bar is "would this skill be used 3+ times across remaining objectives?" If yes, propose it. If only once or twice, skip — direct implementation is faster.
