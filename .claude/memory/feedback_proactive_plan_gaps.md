---
name: Proactively surface gaps in the user's current plans
description: When reviewing scope/objectives/roadmap, hunt for missing goals or implicit-but-unverified properties and surface them as actionable amendments
type: feedback
originSessionId: d416ed7e-3180-4d5a-bde7-55796337c96a
---

When reading the user's plans (master-plan, objectives, roadmap, ADRs), don't just execute the spec — actively look for **gaps**: goals that are missing, properties that are assumed-but-not-declared, success criteria the spec relies on but doesn't verify. Surface them as concrete amendments (e.g., "add these DoD items to Obj 27/29/30/31") rather than vague observations.

**Why:** User confirmed on 2026-05-05 that this is exactly the skill they want. The Layer D promotion case worked: I noticed D1–D6 (standalone runnable, round-trip durability, generated CI/CD, secrets, local dev, end-user docs) were _implicit thesis properties_ but not actually pinned as Definition-of-Done items anywhere — without that catch, V1 could have shipped looking complete while silently failing the dev-grade thesis. The user then asked to update the objectives "before we get to those objectives," confirming the gap-find → propose-amendment → apply pattern is the loop they want.

**How to apply:**

- When reading objectives or planning docs, ask: _what does this rely on that isn't actually verified anywhere?_ Implicit properties of "the thing we're building" are the highest-value gaps.
- When reviewing competitive positioning, ask: _what concrete goal does this thesis assume but the spec doesn't declare?_ Map missing goals to specific objectives or new candidate objectives.
- Distinguish V1 _properties_ (must hold for V1 to ship the thesis) from V2 _features_ (deliberate next-phase additions). If something is assumed for V1 but only listed in V2 scope, that's a misclassification — surface it.
- Always propose a concrete shape: "add DoD items X/Y/Z to Obj N," not "we should think about quality."
- Keep gap-finds within the user's stated thesis. The job is "did you forget anything that's needed for _your_ goal?", not "let me suggest features."
- Surface gaps as part of normal review work, not only when explicitly asked. The user wants this skill applied proactively.
