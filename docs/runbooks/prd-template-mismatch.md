# Runbook: PRD Template Mismatch

**Trigger:** A user selected a template (e.g. CRM) but the intent brief describes a different product type; the generated PRD sections have misaligned emphasis.

---

## Symptoms

- User reports the PRD "feels like it was written for the wrong product"
- Section starters from the template appear verbatim in generated content
- The PRD mentions CRM concepts (e.g. deal stages) for a product that is not a CRM

## Investigation

1. Check the `templateUsed` field on the PRD artifact
2. Compare the template's `sectionStarters` with the intent brief — how different are they?
3. Determine whether the AI incorporated the template hint or overrode it

## Resolution

**If the user selected the wrong template:**
- Guide the user to use "Regenerate all sections" with no template or the correct template
- Future: surface a template recommendation during intent capture based on brief content

**If the template's section starters are too prescriptive:**
- Review the template definition; starters should be hints, not required content
- Soften the language in the starter (replace "This CRM does X" with "A CRM typically does X")
- Redeploy the updated template

**If the AI is ignoring the hint and still generating template-biased content:**
- Check if the user's brief is vague enough that the template fills the vacuum
- The fix is intent quality, not template quality; guide the user to enrich the brief

## Prevention

Templates should always be framed as hints. The system prompt for every section prompt includes: "The template context is a hint, not a constraint — adjust based on the actual intent brief."
