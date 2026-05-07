# Runbook: Sandbox Escape Detected (Security Incident)

## Severity: CRITICAL — Treat as a security incident immediately

## Indicators

- Alert: `sandbox_escape_attempt` in audit events within the past hour
- Runtime monitoring shows a function accessing filesystem paths outside tmpfs
- A function making network requests to non-allowlisted hosts
- Memory anomaly: a function exceeding its limit repeatedly

## Immediate Response

1. **Isolate**: suspend the affected workspace to prevent further execution:
   ```
   platform admin workspaces suspend --workspace-id <id> --reason "security-incident" --immediate
   ```

2. **Preserve evidence**: export all audit events for the workspace in the past 24h:
   ```
   platform admin audit export --workspace-id <id> --since 24h --output /tmp/incident-<id>.json
   ```

3. **Identify the function**: check which function triggered the escape:
   ```sql
   SELECT payload->>'functionId', payload->>'violationType', payload->>'detail', created_at
   FROM audit_events
   WHERE event_type = 'ai.code_generation.static_analysis_violation'
     AND payload->>'severity' = 'sandbox_escape_attempt'
   ORDER BY created_at DESC LIMIT 10;
   ```

4. **Revoke function deployment** if the function is deployed:
   ```
   platform admin functions revoke --function-id <id> --force
   ```

5. **Notify security team**: escalate with the preserved audit export.

6. **Root cause analysis**: determine if the escape vector bypassed static analysis:
   - Was the pattern in `StaticAnalyzer.FORBIDDEN_PATTERNS`?
   - Did the auto-fix prompt produce the escaping code?
   - Was this a novel pattern not in the forbidden list?

7. **Update the forbidden patterns list** to prevent recurrence.

8. **Re-enable workspace** only after the root cause is resolved and the function is removed or patched.

## Prevention

- Alert on ANY `sandbox_escape_attempt` event in real time (zero-tolerance metric)
- Review new prompt versions for patterns that could introduce sandbox escapes before deploying
