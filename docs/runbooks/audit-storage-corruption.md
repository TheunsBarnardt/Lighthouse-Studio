# Runbook: Audit Log Storage Corruption

_For responding to a failed chain integrity verification — the audit log hash chain does not match expectations._

---

## Purpose

Describes what to do when `verifyChain` reports `"status": "tampered"` for one or more workspaces. This can indicate:

1. **Storage bitrot** — hardware or filesystem-level corruption of database blocks
2. **Software bug** — a bug in the platform that caused incorrect hashes to be written
3. **Malicious tampering** — intentional modification of audit records (rare, but the reason the chain exists)
4. **Migration error** — a database migration or restore that modified rows

---

## Severity

Chain verification failure is a **high-severity incident**. Treat it as such until root cause is established.

**Immediately:**

- Do not delete or overwrite any data
- Preserve database state (take a snapshot if possible)
- Escalate to security and engineering leads
- If tampering is suspected, follow [incident-evidence-preservation.md](./incident-evidence-preservation.md) in parallel

---

## Step 1: Confirm and scope the failure

Run verification on all workspaces to determine scope:

```bash
# Script to verify all workspaces
for WORKSPACE_ID in $(curl -s -H "Authorization: Bearer $TOKEN" \
  https://your-platform/api/v1/installation/workspaces | jq -r '.[].id'); do
  echo -n "Workspace $WORKSPACE_ID: "
  curl -s -X POST \
    -H "Authorization: Bearer $TOKEN" \
    https://your-platform/api/v1/workspaces/$WORKSPACE_ID/audit/verify-chain \
    | jq -c '{status, eventsVerified, tamperedAt}'
done
```

Record:

- Which workspaces are affected
- The sequence number where the chain breaks (`tamperedAt.sequence`)
- The expected vs. actual hash at that sequence

---

## Step 2: Determine root cause

### Hypothesis A: Single-row storage corruption (bitrot)

Look at the event at the reported sequence number:

```sql
-- PostgreSQL
SELECT id, sequence, event_type, occurred_at, prev_hash, hash,
       metadata, actor_id
FROM audit_log
WHERE workspace_id = 'affected-workspace-id'
  AND sequence = <tampered-sequence>;
```

If the row content looks garbled or truncated, this is storage corruption. Proceed to **Step 3A**.

### Hypothesis B: Correct data, wrong hash (software bug)

If the row content looks normal but the hash doesn't match what the platform would compute from that content, this may be a hash-computation bug introduced in a recent deployment.

Check:

- When was the last deployment?
- Does the `tamperedAt.sequence` correspond to events after the deployment?
- Do other workspaces show the same break point?

If so, proceed to **Step 3B**.

### Hypothesis C: Row was modified (tampering or migration error)

Compare the row's `hash` field against what the platform would compute from its current content. If the hash in the database matches the stored content but doesn't match the previous event's hash, then either:

- The row was modified and the hash updated to match (tampering)
- A migration script modified rows and recomputed hashes

Check the database's audit trail (PostgreSQL WAL / MSSQL transaction log) for modifications to the `audit_log` table after initial insert.

---

## Step 3A: Storage corruption response

1. **Take a database snapshot immediately** before any further writes
2. Identify the corrupted pages using your database's consistency check:
   ```sql
   -- PostgreSQL
   SELECT * FROM pg_check_relation('audit_log');
   -- Or use pg_dump to see if specific rows fail to export
   ```
3. Restore the affected rows from the most recent backup that predates the corruption
4. After restore, re-run `verifyChain` to confirm integrity
5. File a post-mortem; the corruption may indicate hardware issues requiring investigation

---

## Step 3B: Software bug response

If a deployment introduced a hash-computation bug:

1. **Do not re-verify** with the buggy version
2. Roll back the deployment
3. Identify the range of events written with incorrect hashes (`first_affected_sequence` to `last_affected_sequence`)
4. Recompute the hashes for those events using the correct algorithm:
   - This requires **direct database access** as the migration user (not app_user, which cannot UPDATE)
   - Use the platform's hash recomputation script (see `packages/tools/recompute-audit-hashes.ts`)
5. After recomputation, run `verifyChain`; if it passes, deploy a fix and document the incident

Note: hash recomputation is a privileged operation. It is itself audited at the database level via the migration user's activity log.

---

## Step 3C: Tampering response

If tampering is confirmed or strongly suspected:

1. **Immediately follow [incident-evidence-preservation.md](./incident-evidence-preservation.md)**
2. Do not modify any data — preserve state exactly as found
3. If cold archival is enabled: retrieve the archived chunks for the affected time period and compare against the database; the archived chunks are the ground truth
4. Engage your security incident response process
5. Determine: was access to the database unauthorized? What credentials were used? When?
6. Notify affected workspace owners per your incident notification obligations
7. Document findings for legal purposes

---

## Step 4: Post-incident

After root cause is resolved and chain integrity is restored:

1. Document the incident: what happened, when discovered, root cause, remediation
2. File the incident in your SOC 2 evidence artifacts
3. Update the threat model if the attack vector was not previously considered
4. Add a regression test if the issue was a software bug
5. Schedule an unplanned chain integrity drill within 2 weeks to confirm health

---

## Cold Archive as Ground Truth

If cold archival (optional) is enabled, the archived chunks are signed and immutable. They are the strongest evidence of what the audit log contained at archival time. In a tampering scenario, archived chunks can prove which events existed and which were added/modified/removed after archival.

See [cold-archive-verification.md](./cold-archive-verification.md) for retrieval and verification of cold archive chunks.
