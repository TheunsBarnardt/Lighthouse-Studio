# Runbook: Audit Log Export Request

_For customer requests for a copy of their audit log — for internal compliance reviews, external audits, or SIEM ingestion._

---

## Purpose

Describes how to produce and deliver an audit log export in response to a customer or auditor request.

---

## Who Can Request an Export

| Requester                             | Scope                            | Auth Required                                                            |
| ------------------------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| Workspace owner or admin              | Their workspace's events         | Workspace admin role                                                     |
| Installation auditor                  | Any workspace; cross-workspace   | `installation_auditor` role                                              |
| External auditor (e.g. SOC 2 auditor) | Specific workspace; time-bounded | Installation admin provisions a temporary `installation_auditor` account |

---

## Export Formats

| Format  | Use Case                                           | File Extension |
| ------- | -------------------------------------------------- | -------------- |
| `jsonl` | Programmatic analysis, SIEM import, archival       | `.jsonl`       |
| `csv`   | Spreadsheet review by non-technical auditors       | `.csv`         |
| `cef`   | Common Event Format; ArcSight and compatible SIEMs | `.cef`         |
| `leef`  | Log Event Extended Format; IBM QRadar              | `.leef`        |

Default: `jsonl`.

---

## Procedure

### Step 1: Clarify the request

Before producing an export, confirm:

1. **Time range** — start and end date/time (UTC)
2. **Scope** — specific workspace(s) or installation-wide
3. **Format** — JSONL, CSV, CEF, or LEEF; default JSONL if unspecified
4. **Filters** — specific event types, actors, or resources (optional)
5. **Recipient** — who receives the download link; verify identity before sharing

### Step 2: Produce the export via the admin UI

1. Sign in as `installation_auditor` (or workspace admin for workspace-scoped exports)
2. Navigate to **Installation → Audit Log** (or **Workspace → Audit → Export**)
3. Set filters: time range, workspace, event types
4. Select format
5. Click **Start Export**
6. Wait for the job to complete (typically under 5 minutes for < 1M events)
7. Download the archive; confirm the download link

### Step 3: Produce the export via API (alternative)

```bash
curl -s -X POST \
  -H "Authorization: Bearer $INSTALLATION_AUDITOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "optional-workspace-id",
    "occurredAfter": "2026-01-01T00:00:00Z",
    "occurredBefore": "2026-04-01T00:00:00Z",
    "format": "jsonl"
  }' \
  https://your-platform/api/v1/installation/audit/export \
  | jq .
```

The response includes a `jobId` and a `downloadUrl` (available once complete):

```json
{
  "jobId": "job_abc123",
  "status": "processing",
  "estimatedCompletionAt": "2026-05-02T14:05:00Z"
}
```

Poll for completion:

```bash
curl -s -H "Authorization: Bearer $INSTALLATION_AUDITOR_TOKEN" \
  https://your-platform/api/v1/audit/export-jobs/job_abc123 \
  | jq '{status, downloadUrl, expiresAt}'
```

### Step 4: Verify the export

Before sharing:

1. Download the export
2. Verify it is parseable in the expected format
3. Spot-check a few events against known actions (e.g. a workspace creation you can verify independently)
4. Confirm the time range is correct (first and last event timestamps)

For JSONL:

```bash
# Count events and check first/last
wc -l export.jsonl
head -1 export.jsonl | jq '{occurredAt, eventType, actorKind}'
tail -1 export.jsonl | jq '{occurredAt, eventType, actorKind}'
```

### Step 5: Deliver to recipient

- Share the download URL directly if the recipient has a platform account
- For external auditors without accounts: download locally, encrypt with the auditor's public key or a shared password, deliver via secure channel (not email in plaintext)
- Download links expire in **7 days**. Note the expiry when communicating

### Step 6: Confirm the export is audited

The export operation itself produces an `audit.export.created` event. Confirm it appears:

```bash
curl -s -H "Authorization: Bearer $INSTALLATION_AUDITOR_TOKEN" \
  "https://your-platform/api/v1/installation/audit?eventType=audit.export.created" \
  | jq '.items[0]'
```

---

## PII Handling in Exports

- By default, exports include all fields including PII fields (actor email snapshots, IP addresses)
- For exports to external parties who should not see PII: use the **redacted export** option in the admin UI, which strips fields tagged as PII in the personal data registry
- Document which fields were redacted; this is relevant for GDPR Article 28 obligations

---

## Large Exports (> 1M Events)

For very large exports:

- Use the streaming download; do not attempt to buffer the entire export in memory
- Allow 15-30 minutes for multi-million-event exports
- The export job persists for 7 days; you can resume downloading if interrupted
- For recurring large exports (e.g., monthly SIEM ingest), consider the API with a rolling time window rather than ad-hoc exports

---

## Troubleshooting

| Issue                            | Likely Cause                  | Resolution                                          |
| -------------------------------- | ----------------------------- | --------------------------------------------------- |
| Export job stuck in `processing` | Worker process stalled        | Check worker logs; restart worker if needed         |
| Export file is empty             | Time range contains no events | Confirm time range in UTC; check workspace ID       |
| Download URL expired             | > 7 days elapsed              | Re-run the export                                   |
| Format not parseable             | Encoding issue                | Ensure file encoding is UTF-8; check for truncation |
