# Runbook: Incident Evidence Preservation

_When a security incident or compliance event is discovered, this runbook describes how to capture and preserve evidence before it can be altered or lost._

---

## Purpose

When an incident is discovered — unauthorized access, data breach suspicion, account compromise, audit log anomaly, or suspected insider threat — the first priority is evidence preservation, not remediation. Remediating before preserving evidence can destroy the forensic record.

This runbook covers:

1. What to preserve
2. How to preserve it (platform audit log, application logs, database snapshots)
3. How to prevent further evidence loss while the investigation proceeds
4. GDPR/legal breach notification trigger points

---

## Immediate Actions (within 1 hour of discovery)

### 1. Do not panic; do not immediately revoke credentials or delete data

Instinct says "lock everything down." Evidence says "capture first." Revoking credentials or killing sessions destroys the session record of how the attacker operated. Do not do this until Step 5.

Exception: if an active attack is ongoing and causing ongoing harm (e.g. active ransomware), stop the attack first, then preserve.

### 2. Note the discovery time

Record exactly when and how the incident was discovered. This timestamp anchors the evidence timeline.

### 3. Place a legal hold on all affected workspaces

```bash
# Place holds on suspected workspaces immediately
for WORKSPACE_ID in workspace1 workspace2; do
  curl -s -X POST \
    -H "Authorization: Bearer $INSTALLATION_ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"reason\": \"Security incident hold — discovered $(date -u +%Y-%m-%dT%H:%M:%SZ). Do not remove without CISO authorization.\"}" \
    https://your-platform/api/v1/workspaces/$WORKSPACE_ID/legal-hold
done
```

This prevents retention enforcement from deleting any events while the investigation proceeds.

---

## Evidence to Capture

### Audit log snapshot

Export the full audit log for affected workspaces, covering at minimum 30 days before the suspected incident:

```bash
# Export audit log for the affected period
curl -s -X POST \
  -H "Authorization: Bearer $INSTALLATION_AUDITOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "affected-workspace-id",
    "occurredAfter": "2026-04-01T00:00:00Z",
    "occurredBefore": "2026-05-02T23:59:59Z",
    "format": "jsonl"
  }' \
  https://your-platform/api/v1/installation/audit/export
```

Download the export and store it in evidence storage (immutable if possible).

### Chain integrity verification

Before any intervention, capture the chain verification state:

```bash
curl -s -X POST \
  -H "Authorization: Bearer $INSTALLATION_AUDITOR_TOKEN" \
  https://your-platform/api/v1/workspaces/WORKSPACE_ID/audit/verify-chain \
  | tee chain-verification-$(date +%Y%m%d-%H%M%S).json
```

This documents whether the chain was intact at the time of discovery.

### Database snapshot

Take a database snapshot before any writes that could alter the state:

```bash
# PostgreSQL: create a snapshot
pg_dump -Fc -t audit_log -t audit_chain_state \
  --host=your-db-host --username=readonly_user \
  your_database > audit-snapshot-$(date +%Y%m%d-%H%M%S).dump

# Or if using managed PostgreSQL: take a point-in-time snapshot via your cloud console
```

### Application logs

Capture application logs for the incident window. Application logs contain correlation IDs, request details, and timing that supplements the audit log:

```bash
# Example: retrieve logs from your log aggregator for the incident window
# Replace with your actual log platform command
logcli query '{app="platform-api"}' \
  --from="2026-04-01T00:00:00Z" --to="2026-05-02T23:59:59Z" \
  > api-logs-incident-window.jsonl
```

### Active sessions at time of discovery

```bash
# List active sessions (before revoking anything)
curl -s -H "Authorization: Bearer $INSTALLATION_ADMIN_TOKEN" \
  https://your-platform/api/v1/installation/sessions?status=active \
  | jq . > active-sessions-$(date +%Y%m%d-%H%M%S).json
```

---

## Establishing the Timeline

Using the captured evidence, reconstruct:

1. **First known suspicious event** — earliest audit log entry that appears anomalous
2. **Scope of access** — which workspaces, resources, and actors are involved
3. **Actor identity** — user IDs, IP addresses, session IDs from the audit log
4. **Blast radius** — what data was read, modified, or exported during the incident window

Key audit events to investigate:

```bash
# Sign-in from unusual IPs
# (filter by actor then review ip_address fields)

# Failed auth attempts (brute force signal)
curl -s -H "Authorization: Bearer $INSTALLATION_AUDITOR_TOKEN" \
  "https://your-platform/api/v1/installation/audit?eventType=auth.signin.failed,auth.signin.locked_out" \
  | jq '.items[] | {occurredAt, actorEmail: .actor.email, ip: .ipAddress}'

# Privilege escalation
curl -s -H "Authorization: Bearer $INSTALLATION_AUDITOR_TOKEN" \
  "https://your-platform/api/v1/installation/audit?eventType=workspace.member.role_assigned,workspace.role.created" \
  | jq '.items[] | {occurredAt, actor: .actor.id, target: .resource.id}'

# Audit log exports (attacker may have taken a copy)
curl -s -H "Authorization: Bearer $INSTALLATION_AUDITOR_TOKEN" \
  "https://your-platform/api/v1/installation/audit?eventType=audit.export.created" \
  | jq '.items[] | {occurredAt, actor: .actor.id, metadata}'

# Data subject exports (attacker accessing PII)
curl -s -H "Authorization: Bearer $INSTALLATION_AUDITOR_TOKEN" \
  "https://your-platform/api/v1/installation/audit?eventType=data.subject.access_requested,data.subject.access_completed" \
  | jq '.'
```

---

## After Evidence is Preserved: Containment

Once evidence is captured and legal holds are in place:

1. Revoke sessions for compromised accounts: **Installation → User Directory → [user] → Revoke All Sessions**
2. Reset credentials for compromised accounts
3. If a service account API key was compromised: rotate it
4. Review and revoke any roles or permissions granted during the incident window

---

## Breach Notification Assessment

Under GDPR Article 33, a personal data breach must be reported to the supervisory authority **within 72 hours** of becoming aware of it, where feasible.

Assess:

- Was personal data accessed, modified, or exfiltrated?
- How many individuals are affected?
- What categories of data (contact, authentication, financial)?
- What are the likely consequences for affected individuals?

If a notifiable breach: engage your data protection officer (DPO) immediately. The audit log export and timeline you've captured is the evidence required for the breach notification report.

Under GDPR Article 34, notify affected individuals if the breach is likely to result in high risk to their rights and freedoms.

---

## Evidence Storage

Store all captured artifacts in:

- A dedicated evidence directory with restricted access
- Immutable storage if available (object lock)
- Named with timestamps: `evidence-incident-YYYYMMDD-<description>/`

Do not store evidence on the same system that was compromised.

---

## Post-Incident

- Root cause analysis document
- Timeline reconstruction
- Controls that failed and why
- Remediation actions taken
- Threat model update if new attack vector identified
- ADR or runbook update if process gaps were discovered
- GDPR/regulatory notification records filed
