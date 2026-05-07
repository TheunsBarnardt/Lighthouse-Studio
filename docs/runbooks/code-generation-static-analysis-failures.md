# Runbook: High Rate of Static Analysis Failures in Generated Functions

## Symptoms

- Many functions blocked at static analysis with `forbidden_import` or `forbidden_call` violations
- Metric `code_generation_static_analysis_pass_rate` drops below 80%
- Customer reports "most functions show red ✗ in Analysis tab"

## Steps

1. Identify which violation type is most common:
   ```sql
   SELECT payload->>'violationType' AS type, COUNT(*) AS count
   FROM audit_events
   WHERE event_type = 'ai.code_generation.static_analysis_violation'
     AND created_at > NOW() - INTERVAL '1 hour'
   GROUP BY 1 ORDER BY 2 DESC;
   ```

2. Common patterns → root cause:

   | Violation | Root cause | Fix |
   |-----------|-----------|-----|
   | `forbidden_import: fs` | A prompt changed and started recommending file I/O | Update the prompt's system prompt; remove file I/O patterns from examples |
   | `forbidden_call: eval` | Template code included eval for dynamic dispatch | Remove eval pattern from all prompt templates |
   | `unsafe_pattern: process.env` | Prompt generating credential access via env | Update prompt to use `ctx.secrets` pattern exclusively |

3. If the violation is in the `static-fix` prompt's output (the auto-fix failed), check the fix prompt's system message for outdated guidance.

4. For isolated customer cases (one workspace, one project), regenerate the affected functions with feedback: "Do not use `fs` or `eval`; use the SDK for all data operations."

5. If the platform team added a new forbidden pattern, verify the `StaticAnalyzer.FORBIDDEN_PATTERNS` array is consistent with the prompt system messages.

## Prevention

- Monitor `code_generation_static_analysis_pass_rate` alert at < 80%
- Run prompt regression tests in CI; any prompt change that causes a known-good test to produce a forbidden pattern fails the build
