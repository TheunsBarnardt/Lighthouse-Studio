# Runbook: Telemetry Events Not Arriving from Exported Site

**Severity:** Low
**Trigger:** A deployed exported site is live but no telemetry events appear in the Logs surface

---

## Symptoms

- Exported site is deployed and accessible
- No `DOC_TELEMETRY_RECEIVED` audit events appear in the platform
- Logs show no inbound requests from the deployed site

---

## Diagnosis

1. **Check if telemetry was enabled at export time** — the export dialog's telemetry toggle must be on
2. **Check the deployed site's `lib/telemetry.ts`** — if it exports a no-op function, telemetry was disabled
3. **Check CORS headers** — the telemetry endpoint must allow the deployed site's domain
4. **Check the export token** — tokens expire after 90 days; a lapsed token causes silent drops

---

## Resolution

### Token expired

1. Re-export the documentation site — a new export token is generated
2. Redeploy the exported site with the new token

### CORS misconfiguration

1. Add the deployed domain to the platform's CORS allowlist for the telemetry endpoint
2. No re-export needed — just a config change in the platform

### Telemetry disabled

1. Re-export with telemetry enabled
2. Redeploy

---

## Prevention

- Alert when an export token is within 7 days of expiry
- Show telemetry event count in the Docs surface (last 30 days) so operators notice absence
