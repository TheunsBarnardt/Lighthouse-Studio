# Runbook: Schema Synthesis PII Detection Tuning

**Trigger:** PII detection producing too many false positives or false negatives per workspace feedback.

## Too Many False Positives

**Symptom:** Users repeatedly rejecting PII detections for clearly non-personal columns (e.g., `category_name` being flagged as name PII).

### Investigation

Check rejection rates:

```sql
SELECT meta->>'columnId', meta->>'accepted', count(*)
FROM audit_events
WHERE event = 'ai.schema_synthesis.pii_confirmed'
  AND meta->>'accepted' = 'false'
GROUP BY 1, 2
ORDER BY 3 DESC;
```

If specific column patterns (e.g., `*_name`) are consistently rejected, the heuristic is too broad.

### Remediation

The PII detection system prompt in `pii-detection.prompt.ts` lists heuristic patterns. Narrow the patterns to require more context:

- `name` → only PII when in a table whose name suggests a person entity (`users`, `contacts`, `customers`, `employees`)
- Add context-checking: "Consider the table name when evaluating column PII likelihood"

## Too Many False Negatives

**Symptom:** Users adding PII flags to columns the AI missed (tracked via `ai.schema_synthesis.pii_confirmed` events where `accepted: false` but the user manually added the PII category afterward).

This is harder to detect automatically. Look for support tickets about GDPR compliance issues post-approval.

### Remediation

Extend the heuristic list in `pii-detection.prompt.ts` with the missed patterns. Add a catch-all: "If in doubt, flag as medium confidence and let the user confirm."

## Workspace-Specific Tuning

For workspaces in specific domains (healthcare, finance) where PII is more prevalent:

1. Add a workspace-level PII sensitivity setting: `normal` or `enhanced`
2. In `enhanced` mode, the PII detection prompt receives additional domain-specific PII categories
3. This is configured in workspace settings, not in code

## Prevention

- Track the PII acceptance rate (`accepted: true / total`) per prompt version
- Alert when acceptance rate drops below 0.6 (indicates high false positive rate)
- Alert when user-added PII flags exceed 5% of AI-detected flags (indicates false negatives)
