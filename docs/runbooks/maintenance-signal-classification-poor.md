# Runbook: Signal Classification Quality Is Poor

**Severity:** Medium
**Trigger:** Operators consistently overriding AI classification; high override rate in metrics

---

## Symptoms

- Operators frequently change the suggested pipeline stage or severity after ingest
- Signals classified as `low` are later escalated to `critical` manually
- Change requests created from misclassified signals reference wrong pipeline stages

---

## Diagnosis

1. Check the classification confidence scores for recent signals:
   ```
   SELECT signal_id, classification->>'confidence' as confidence, 
          classification->>'stage' as stage
   FROM signals
   WHERE workspace_id = '<workspace>'
   ORDER BY ingested_at DESC LIMIT 50;
   ```

2. Look for patterns in overrides — is one signal source consistently wrong?

3. Review the signal messages that are being misclassified — are they ambiguous?

---

## Resolution

### Short-term

1. Manually reclassify affected signals via the Signals tab → click the classification badge → override
2. Create change requests based on corrected classifications

### Long-term

1. If a signal source consistently produces ambiguous messages, improve the ingestion adapter
   to add more context (e.g., stack traces, component names, stage identifiers)
2. If a specific signal type is always misclassified, add examples to the classification prompt's
   system context in `packages/core/src/ai/prompts/maintenance/signal-classification.prompt.ts`
3. Review `outputs.stages` confidence thresholds — signals with confidence < 0.6 could be
   routed to a "needs review" queue rather than auto-classified

---

## Prevention

- Keep signal messages descriptive — generic messages like "error occurred" provide no signal for classification
- Instrument generated applications with stage-aware error context (e.g., `X-Pipeline-Stage` header)
