---
name: Evolutionary self-improvement after each task
description: After substantive work, reflect for memory/skill/hook/agent upgrade opportunities and propose them; never let skills, agents, or tooling habits go stale
type: feedback
originSessionId: bf119e82-fb50-4d41-88af-ce85dbeb3c87
---

After each non-trivial task, run a short reflection pass and propose (do not silently apply) upgrades when warranted:

1. **Memory** — Did I learn a non-obvious fact, correction, or validated judgment? If yes, write a `feedback_*` / `project_*` / `user_*` / `reference_*` memory. Skip generic observations.
2. **Skills** — Did I just execute a workflow I'd repeat? If yes, propose a new skill (or upgrade an existing one) via `skill-creator`. Already-codified repo skills: objective-verifier, service-shape-check, adr-writer.
3. **Hooks / settings** — Was there an automation the user implied ("from now on…", "every time…")? Propose a `settings.json` hook via `update-config` — memory cannot enforce automation.
4. **Agents** — Recurring multi-step pattern? Propose a dedicated subagent definition.
5. **Tool freshness** — Before reaching for Bash, check if a dedicated tool or skill fits better. Track new model IDs / capabilities; flag when `/fast` or a different model would serve the task better.
6. **Stale-memory pruning** — If a memory contradicts current code, update or delete it rather than acting on it. Run `consolidate-memory` periodically.

**Why:** User explicitly asked (2026-05-03) for evolutionary improvement — "none of your skills must be static or old, tech change models change and capability you must always be one step ahead." Confirmed they want this as a persistent directive.

**How to apply:** Trigger at the end of any task that involved real engineering judgment (objective work, debugging, architectural choices, repeated workflows). Skip for trivial fixes (typos, single-line changes, lookup questions). Always _propose_ before writing skills/hooks/agents — only memory writes are autonomous. Be honest that "improvement" happens at write-time, not mid-response; do not pretend to self-modify within a single turn.

**Memory routing (shared vs private):**

- **Shared** (`.claude/memory/`, committed): project conventions, skill availability, workflow discipline — anything a future collaborator cloning the repo would benefit from. Default destination for `project_*` memories and `feedback_*` memories about _how work is done in this repo_.
- **Private** (`.claude/memory-private/`, gitignored): personal user preferences/style, sensitive context about the user, off-the-cuff observations. Default destination for `user_*` memories and feedback that's about the _individual user_ rather than the project.
- When unsure, ask once or default to private (safer to leak nothing than to leak something personal).
- The shared `MEMORY.md` is auto-loaded via the junction; the private `MEMORY.md` must be read on demand at session start as part of orient discipline.
