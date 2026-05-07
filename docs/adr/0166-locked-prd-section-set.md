# ADR-0166: Locked PRD Section Set

**Status:** Accepted
**Date:** 2026-05-07
**Objective:** 22 (Stage 2: PRD Generation)

## Context

A PRD could be structured many ways. Some teams use five sections; others use fifteen. Different project types emphasize different concerns: a consumer mobile app PRD might have a detailed onboarding section, while an internal tooling PRD might have a compliance section. There is a reasonable argument that the platform should allow workspaces to configure their own PRD structure — adding sections, removing sections, renaming them.

The counterargument is downstream consumption. The PRD is not a document that humans read and interpret freely. It is a structured artifact that Stage 3 (Design Tokens), Stage 4 (Schema), Stage 6 (UI Generation), Stage 8 (Test Generation), and other pipeline stages consume programmatically. Each downstream stage references specific section types. Stage 8, for example, reads `functional_requirements` by type to generate test cases from acceptance criteria. Stage 4 reads `non_functional_requirements` by type to determine performance targets for schema optimizations. If sections are configurable, downstream prompts cannot rely on known section types existing — they must discover structure at runtime, complicating every downstream prompt and producing worse output.

Additionally, the platform supports workspace-level PRD templates (starter hints per section) and section-level approval routing configuration. Both of these need a stable section vocabulary to configure against.

## Decision

The 10 PRD sections are locked by a TypeScript enum (`PrdSectionType`) and cannot be added, removed, or renamed at runtime. The sections are:

1. `overview`
2. `goals_and_success_metrics`
3. `target_users_and_personas`
4. `user_stories`
5. `functional_requirements`
6. `non_functional_requirements`
7. `constraints_and_assumptions`
8. `out_of_scope`
9. `open_questions`
10. `risks_and_mitigations`

Expanding the depth and richness of any section's content is encouraged; adding a new section type is a platform-level change requiring a new ADR, prompt, and downstream updates — not a runtime configuration.

## Rationale

1. **Predictability for downstream stages.** Every downstream stage references section types by name. A fixed vocabulary means downstream prompts can be written, tested, and deployed with certainty about what they will receive.

2. **Coverage detection.** The traceability check (ADR-0169) verifies that intent goals are covered by requirements. This only works if the section types are known at build time — the check knows to look in `functional_requirements`, not in a dynamically named section called "capabilities."

3. **Approval routing configuration.** Section-level approval routing (ADR-0167) is configured per section type. A stable enum means workspace admins configure routes once; new sections don't appear and break routing.

4. **Template system.** Built-in PRD templates provide starter hints keyed on section type. If section types were extensible, templates would need a discovery mechanism for new types.

5. **Depth over breadth.** Any legitimate requirement for "more granularity" can be addressed within existing sections. A team that wants a dedicated "compliance" section can add compliance content to `constraints_and_assumptions` with a `type: 'regulatory'` constraint. The structure inside sections is rich and extensible.

## Consequences

**Easier:**

- Downstream stage prompts are written once against a known structure
- Traceability and coverage checking are deterministic
- Approval routing configuration is stable
- PRD export templates (markdown, PDF) have a fixed layout

**Harder:**

- Teams with unusual PRD structures must adapt their workflow to the 10-section model
- Adding a genuinely new section type requires a coordinated platform change across prompts, downstream stages, UI, and documentation
- Highly specialized project types (e.g., hardware products, research proposals) may need to stretch existing section definitions

**Alternatives considered:**

- **Fully configurable sections per workspace:** Maximum flexibility; rejected because downstream stage consumption requires a known structure. Every downstream prompt would need a discovery-and-adaptation layer, increasing complexity and reducing generation quality.
- **Fixed core sections plus workspace-defined extension sections:** Hybrid approach; rejected because downstream stages need to know whether to look in core or extension sections, adding ambiguity. Extension sections that downstream stages ignore provide the illusion of flexibility without the substance.
