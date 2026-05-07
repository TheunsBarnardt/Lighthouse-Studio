# Runbook: Accessibility Violations Persist After Automatic Retry

## Symptoms

- Component marked `a11y_warning` after generation
- `AccessibilityReport.passed === false` with `retriedFix: true`
- Customer reports screen reader issues post-export

## Steps

1. Retrieve the accessibility report:
   ```
   GET /api/ui-generation/projects/<id>/components/<name>/accessibility
   ```
   Review `violations[]` — each entry has `id` (axe rule), `impact`, and `nodes`.

2. Common persistent violations and manual remediation guidance:

   | axe Rule | Impact | Manual Fix |
   |----------|--------|-----------|
   | `color-contrast` | serious | Adjust Tailwind text/bg classes in the generated component to meet 4.5:1 ratio; the design tokens may have an insufficient contrast pair |
   | `aria-required-parent` | critical | The model placed an ARIA widget child outside its required parent container; restructure the JSX |
   | `landmark-unique` | moderate | Multiple `<main>` elements generated; wrap inner content in `<section>` instead |
   | `focus-order-semantics` | moderate | Tab order is disrupted by absolute positioning; add explicit `tabIndex` or restructure DOM order |

3. Instruct the customer to use the Regenerate dialog with specific feedback targeting the violation. Example: "Fix color contrast: use `text-zinc-900` on `bg-white` backgrounds instead of `text-zinc-400`."

4. If the axe rule is a false positive (legitimate pattern that axe flags incorrectly), note the component name and rule in the issue tracker. The accessibility validator can be updated to suppress known false positives.

5. For critical violations that block export, an admin can override the warning:
   ```
   platform admin ui-generation override-a11y --project-id <id> --component <name> --reason "<justification>"
   ```
   This action is audited.

## Prevention

- Monitor `ui_generation_a11y_violation_rate` by rule ID to identify prompts that systematically produce violations.
- Update the `accessibility-fix` prompt with examples of the most common violation patterns.
