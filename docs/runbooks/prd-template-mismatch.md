# Runbook: PRD Template Mismatch

## Symptoms

- Users report that generated PRD sections feel "off" for their project type — the content references concepts irrelevant to their product.
- A user selected a built-in template (e.g., "CRM") but the generated sections describe personas or features typical of a different template category.
- User feedback on generated sections mentions that the AI "ignored the intent brief" or "generated a generic PRD."
- Support requests reference a specific template ID and describe consistent misfits.

## Likely Causes

1. **Template starter hints conflict with the intent brief** — the selected template's `sectionStarters` contain strong domain-specific language (e.g., "sales reps and pipeline stages") that the AI weights over the actual intent content when the intent is in a different domain.
2. **Template category does not match the project** — the user selected a template that sounded applicable but was written for a significantly different use case.
3. **Prompt does not clearly weight intent over template** — the section generation prompt treats template hints as constraints rather than hints, causing them to override intent content.
4. **Template starters are outdated** — the template was written for an earlier version of the intent brief schema; the fields it references no longer exist in the current schema.
5. **New project type not covered** — the user's project type does not match any built-in template, but they selected the closest-sounding one; a new template is needed.

## Investigation Steps

1. **Reproduce with the specific template** — take the user's intent brief (anonymised if needed) and generate a PRD using the reported template. Does the section mismatch reproduce?

2. **Compare template starters against intent brief** — review the `sectionStarters` for the affected template in `packages/core/src/services/ai/prd-generation/templates/<template>.template.ts`. Are the starters strongly domain-specific in a way that would override a different-domain intent?

3. **Review section generation prompt instructions** — check whether `packages/core/src/services/ai/prd-generation/prompts/<section>.prompt.ts` gives clear precedence to intent brief content over template starter hints. The correct instruction is "use the following as a starting context and emphasis guide; the intent brief is the authoritative source."

4. **Check for schema drift** — review whether the template's starter text references intent brief fields that no longer exist or have been renamed in the current intent brief schema.

5. **Assess whether a new template is needed** — if the mismatch is because no suitable template exists for the user's project type and they selected the closest available option, a new template may resolve the class of complaints.

## Resolution

1. **If the prompt over-weights template over intent:** Update the section generation prompts to explicitly subordinate template hints to intent content. Add a test case that uses a mismatched template and verifies the output reflects the intent, not the template.

2. **If the template starters are too domain-specific:** Soften the language in the affected `sectionStarters` fields. Replace domain-specific nouns with more general framing that provides structure without forcing domain-specific content. For example, replace "sales reps tracking pipeline stages" with "the primary operational users managing the core workflow."

3. **If the template references stale intent brief fields:** Update the template's starter text to reference the current intent brief field structure.

4. **If a new template is needed:** Assess whether the user's project type represents a common enough pattern to warrant a built-in template. If yes:

   - Create a new `<name>.template.ts` in `packages/core/src/services/ai/prd-generation/templates/`
   - Add it to the `BUILTIN_TEMPLATES` array in `index.ts`
   - Write a brief description for the user guide

5. **If the template was the wrong choice:** Advise the user to regenerate using a different template or with no template (blank starters). Regenerating with an appropriate template uses the same per-section infrastructure.

## Prevention

- Template test cases should include a "wrong domain" test: select a CRM template with a clearly non-CRM intent brief and verify the output reflects the intent, not the template.
- When a new template is added, include at least one test case that uses the template with an intent brief at the edges of its intended domain.
- Monitor user feedback tags for template-related quality issues; a pattern across 3+ reports for the same template is a signal to review that template's starters.
