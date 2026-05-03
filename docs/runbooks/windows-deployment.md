# Runbook: Windows Server Deployment

> **Note:** This runbook is a quick-reference operational guide for ops teams.
> For a full step-by-step installation guide, see [docs/deployments/windows.md](../deployments/windows.md).

---

## Architecture overview

On Windows Server, the platform runs as:

- **Node.js web app** — managed as a Windows Service via `node-windows` (see ADR-0086)
- **Node.js worker** — managed as a separate Windows Service via `node-windows`
- **IIS** — reverse proxy via Application Request Routing (ARR) + URL Rewrite (see ADR-0085)
- **SQL Server** — using the `mssql` adapter (Objective 4a)
- **Entra ID** — recommended identity provider; Windows Integrated Auth also supported (see ADR-0087)
- **Azure Key Vault** — optional secret store (see ADR-0088)

Node process lifecycle is managed entirely by `node-windows` / Windows SCM — not NSSM, winsw, or PM2.
PM2 is a documented alternative but not the default. NSSM and winsw are not used in new deployments.

---

## Service names

| Service           | Description                               | Port             |
| ----------------- | ----------------------------------------- | ---------------- |
| `Platform Web`    | Web application; IIS proxies to this      | `127.0.0.1:3000` |
| `Platform Worker` | Background job processor; no inbound HTTP | —                |

---

## Prerequisites

- Windows Server 2019 or 2022 (Server 2022 recommended)
- Node.js 22 LTS (official Microsoft-signed x64 MSI)
- pnpm 9+ (via corepack)
- IIS 10 with ARR 3.0 and URL Rewrite 2.1
- SQL Server 2019+ (separate server recommended for production)
- Administrator privileges

---

## Install / first-time setup

See [docs/deployments/windows.md](../deployments/windows.md) for the full guide.

Quick summary:

```powershell
# 1. Install dependencies
corepack enable && corepack prepare pnpm@9 --activate

# 2. Extract release artifact to C:\Platform
Expand-Archive platform-<version>.zip -DestinationPath C:\Platform

# 3. Configure environment
Copy-Item C:\Platform\.env.example C:\Platform\.env
notepad C:\Platform\.env    # Fill in DATABASE_URL, secrets, etc.

# 4. Set up IIS ARR
powershell -ExecutionPolicy Bypass -File C:\Platform\deploy\iis\setup-iis-arr.ps1

# 5. Generate and deploy web.config
node C:\Platform\deploy\iis\web.config.generate.mjs --port 3000 --output C:\inetpub\platform\web.config

# 6. Install services (as Administrator)
cd C:\Platform\web   && node --enable-source-maps scripts\install-windows-service.mjs
cd C:\Platform\worker && node --enable-source-maps scripts\install-windows-service.mjs
```

---

## Common operational tasks

### Start / stop / restart services

```powershell
Start-Service "Platform Web", "Platform Worker"
Stop-Service "Platform Web", "Platform Worker" -Force
Restart-Service "Platform Web", "Platform Worker"
```

### Check service status

```powershell
Get-Service "Platform Web", "Platform Worker" | Format-Table Name, Status, StartType
```

### View recent logs (Event Log)

```powershell
Get-EventLog -LogName Application -Source "Platform Web","Platform Worker" -Newest 50 | Format-Table TimeGenerated, EntryType, Message -Wrap
```

### View file logs

```powershell
Get-Content C:\Platform\logs\web\current.log -Tail 100
Get-Content C:\Platform\logs\worker\current.log -Tail 100
```

### Health check

```powershell
Invoke-WebRequest http://127.0.0.1:3000/_status -UseBasicParsing
```

---

## Upgrade

See [windows-upgrade-procedure.md](./windows-upgrade-procedure.md).

---

## Rollback

See [windows-deployment-rollback.md](./windows-deployment-rollback.md).

---

## Troubleshooting

| Symptom                    | Runbook                                                                        |
| -------------------------- | ------------------------------------------------------------------------------ |
| Service won't start        | [windows-service-not-starting.md](./windows-service-not-starting.md)           |
| 502 Bad Gateway            | [windows-iis-502-bad-gateway.md](./windows-iis-502-bad-gateway.md)             |
| Certificate expired        | [windows-certificate-renewal.md](./windows-certificate-renewal.md)             |
| Key Vault access error     | [windows-azure-key-vault-access.md](./windows-azure-key-vault-access.md)       |
| MSSQL connection failure   | [windows-mssql-connection-issues.md](./windows-mssql-connection-issues.md)     |
| Service stops unexpectedly | [windows-graceful-shutdown.md](./windows-graceful-shutdown.md)                 |
| Event Log entries          | [windows-event-log-troubleshooting.md](./windows-event-log-troubleshooting.md) |
