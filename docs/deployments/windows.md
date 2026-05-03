# Windows Server Deployment Guide

**Platform version:** current  
**Minimum OS:** Windows Server 2019 (Windows Server 2022 recommended)  
**Node.js:** 22 LTS (official Microsoft-signed MSI)  
**Database:** SQL Server 2019+ (separate server recommended for production)

---

## Architecture summary

```
Internet ──HTTPS──▶ IIS (ARR reverse proxy) ──HTTP──▶ Node.js :3000 (Platform Web service)
                                                        │
                                             Node.js :3001 (Platform Worker service)
                                                        │
                                             SQL Server (separate server or same)
                                                        │
                                             Azure Blob Storage  (optional)
                                                        │
                                             Entra ID / AD (identity)
```

Both Node processes run as Windows Services managed by `node-windows`. IIS terminates TLS and reverse-proxies to the web app on localhost. The worker handles background jobs and does not receive inbound HTTP traffic.

---

## 1. Prerequisites

Before starting, verify:

| Requirement        | Version      | Notes                                |
| ------------------ | ------------ | ------------------------------------ |
| Windows Server     | 2019 or 2022 | Domain-joined for Entra/WIA          |
| Node.js            | 22.x LTS     | Download from nodejs.org             |
| pnpm               | 9+           | Installed via corepack               |
| IIS                | 10.0         | Installed via Server Manager         |
| ARR module         | 3.0          | Installed via Web Platform Installer |
| URL Rewrite module | 2.1          | Installed via Web Platform Installer |
| SQL Server         | 2019 or 2022 | With CDC-enabled `platform` database |
| .NET Framework     | 4.8          | Already present on Server 2019/2022  |

**Administrator rights required** for: Node install, IIS configuration, Windows Service install.

---

## 2. Install Node.js

1. Download the Node.js 22 LTS **x64 MSI** from [nodejs.org/en/download](https://nodejs.org/en/download).
2. Run the installer. Accept all defaults. The installer adds `node` and `npm` to `%PATH%`.
3. Verify:

```powershell
node --version   # 22.x.x
npm --version
```

4. Enable corepack and activate pnpm:

```powershell
corepack enable
corepack prepare pnpm@9 --activate
pnpm --version   # 9.x.x
```

---

## 3. Extract and install the platform

Download the release artifact (`platform-<version>.zip`) and extract to `C:\Platform`.

```powershell
Expand-Archive -Path "platform-<version>.zip" -DestinationPath "C:\Platform"
cd C:\Platform
```

The directory structure after extraction:

```
C:\Platform\
  web\         ← web app (dist/ + node_modules/ + scripts/)
  worker\      ← worker (dist/ + node_modules/ + scripts/)
  shared\      ← shared utilities
  .env.example ← environment variable template
```

Copy and fill in the environment file:

```powershell
Copy-Item .env.example .env
notepad .env     # Fill in DB credentials, secrets, etc.
```

Environment variables required:

| Variable               | Description                                           |
| ---------------------- | ----------------------------------------------------- |
| `DATABASE_URL`         | MSSQL connection string (`mssql://user:pass@host/db`) |
| `NODE_ENV`             | `production`                                          |
| `PLATFORM_HOME`        | `C:\Platform`                                         |
| `PLATFORM_WEB_PORT`    | `3000` (default)                                      |
| `PLATFORM_WORKER_PORT` | `3001` (default)                                      |
| `SESSION_SECRET`       | Random 64-char hex string                             |
| `ENTRA_CLIENT_ID`      | Azure AD app client ID (if using Entra)               |
| `ENTRA_CLIENT_SECRET`  | Azure AD app client secret                            |
| `ENTRA_TENANT_ID`      | Azure AD tenant ID                                    |

For Azure Key Vault instead of `.env`, set `SECRET_STORE=azure-keyvault` and `KEY_VAULT_URI=https://your-vault.vault.azure.net`.

---

## 4. Install Windows Services

Run the install scripts from an **elevated (Administrator) PowerShell prompt**:

```powershell
cd C:\Platform\web
node --enable-source-maps scripts\install-windows-service.mjs

cd C:\Platform\worker
node --enable-source-maps scripts\install-windows-service.mjs
```

Verify the services appear in the Services console (`services.msc`):

- `Platform Web` — Status: Running, Start type: Automatic
- `Platform Worker` — Status: Running, Start type: Automatic

Check the Event Log under **Windows Logs → Application** for entries from source `Platform Web` and `Platform Worker`.

---

## 5. Configure IIS

### 5.1 Install ARR and URL Rewrite

Run the IIS setup script (elevated PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File C:\Platform\deploy\iis\setup-iis-arr.ps1
```

This script:

- Installs ARR 3.0 and URL Rewrite 2.1 via Web Platform Installer (if not present)
- Enables proxy mode in ARR
- Disables reverse proxy cache (appropriate for an API-first app)

### 5.2 Create the IIS site

1. Open IIS Manager.
2. Add a new site: **Platform** (or your chosen name).
3. Set the physical path to `C:\Platform\web\public` (static assets) or any valid directory — the `web.config` will redirect all requests to Node.
4. Bind to port 80 (HTTP) initially; add the HTTPS binding in step 5.3.

### 5.3 Deploy the web.config

Generate the `web.config` for this server:

```powershell
cd C:\Platform
node deploy\iis\web.config.generate.mjs --port 3000 --output C:\inetpub\platform\web.config
```

Verify IIS picks up the config: browse to `http://localhost/_status` — you should see a JSON health response from the Node app.

### 5.4 Bind a TLS certificate

**Using an existing certificate (PFX):**

```powershell
powershell -ExecutionPolicy Bypass -File C:\Platform\deploy\iis\bind-certificate.ps1 `
  -CertPath "C:\certs\platform.pfx" `
  -CertPassword "your-pfx-password" `
  -SiteName "Platform" `
  -Hostname "platform.yourdomain.com"
```

**Using Let's Encrypt via win-acme:**

Install [win-acme](https://www.win-acme.com/), then:

```powershell
wacs --target iis --siteid <site-id> --validation selfhosting --store certificatestore
```

win-acme automatically renews the certificate and rebinds it to IIS.

After binding HTTPS, force HTTP → HTTPS redirect in IIS using a URL Rewrite rule (included in the generated `web.config`).

---

## 6. Configure SQL Server

The platform requires a dedicated SQL Server database.

### 6.1 Create database and user

```sql
CREATE DATABASE [platform] COLLATE SQL_Latin1_General_CP1_CI_AS;
GO

CREATE LOGIN [platform_user] WITH PASSWORD = 'a-strong-password-here';
GO

USE [platform];
GO

CREATE USER [platform_user] FOR LOGIN [platform_user];
ALTER ROLE db_datareader ADD MEMBER [platform_user];
ALTER ROLE db_datawriter ADD MEMBER [platform_user];
GRANT ALTER ON SCHEMA::dbo TO [platform_user];
GRANT CREATE TABLE TO [platform_user];
GO
```

### 6.2 Enable CDC

CDC (Change Data Capture) is required for the change-stream adapter:

```sql
USE [platform];
EXEC sys.sp_cdc_enable_db;
GO

-- Enable SQL Server Agent (required for CDC)
```

In SQL Server Configuration Manager, set SQL Server Agent to **Automatic** start and start it.

### 6.3 Run migrations

```powershell
cd C:\Platform
node --enable-source-maps shared\migrate.mjs --adapter mssql
```

---

## 7. Configure Entra ID (recommended identity provider)

1. In Azure Portal, go to **Microsoft Entra ID → App registrations → New registration**.
2. Name: `Platform (Production)`.
3. Redirect URI: `https://platform.yourdomain.com/auth/callback`.
4. Under **Certificates & secrets**, create a client secret. Copy the value.
5. Under **API permissions**, add `User.Read` (Microsoft Graph, delegated).

Set in `.env` (or Key Vault):

```
ENTRA_CLIENT_ID=<Application (client) ID>
ENTRA_CLIENT_SECRET=<secret value>
ENTRA_TENANT_ID=<Directory (tenant) ID>
```

---

## 8. Windows Integrated Authentication (optional)

For on-premises AD customers wanting Kerberos SSO:

1. In IIS Manager, navigate to the Platform site → **Authentication**.
2. Disable **Anonymous Authentication**.
3. Enable **Windows Authentication**.
4. In IIS `web.config`, add the `LOGON_USER` header forwarding rule (already in the template if `--wia` flag was used with the generate script).
5. Set in `.env`:

```
IDENTITY_PROVIDER=windows-integrated
WINDOWS_AUTH_HEADER=LOGON_USER
TRUSTED_PROXY_IPS=127.0.0.1
```

**Security note:** With WIA enabled, the Node port (`:3000`) must not be reachable from any path other than IIS. Verify with `netstat -an | findstr 3000` that the port binds to `127.0.0.1` only.

---

## 9. Azure Key Vault (optional, recommended for production)

1. Create a Key Vault in Azure Portal.
2. Grant the service account (or managed identity) **Key Vault Secrets User** role.
3. Add secrets with the `platform-` prefix (e.g., `platform-database-url`, `platform-session-secret`).
4. Set in `.env`:

```
SECRET_STORE=azure-keyvault
KEY_VAULT_URI=https://your-vault.vault.azure.net
```

The platform reads all `platform-*` secrets at startup and caches them. A service restart is required after secret rotation.

---

## 10. First-run verification

Run through the [Windows Deployment Verification Checklist](./windows-verification.md):

```powershell
# Quick smoke test
Invoke-WebRequest https://platform.yourdomain.com/_status
# Expected: {"status":"ok","environment":"production",...}
```

If the status endpoint fails, check:

1. `Platform Web` service is Running (`Get-Service "Platform Web"`)
2. IIS site is started and bound to port 443
3. ARR proxy is enabled (`IIS → Server → Application Request Routing Cache → Server Proxy Settings → Enable proxy`)
4. Windows Firewall allows inbound 443 (`netsh advfirewall firewall show rule name=all | findstr 443`)

---

## 11. Day-2 operations

### Restart services

```powershell
Restart-Service "Platform Web"
Restart-Service "Platform Worker"
```

### View logs

**File logs** (JSON, rotating):

```powershell
Get-Content C:\Platform\logs\web\current.log -Tail 100
```

**Event Log:**

```powershell
Get-EventLog -LogName Application -Source "Platform Web" -Newest 50
```

Or in Event Viewer: **Windows Logs → Application → filter by Source: Platform Web**.

### Check service status

```powershell
Get-Service "Platform Web", "Platform Worker" | Format-Table Name, Status, StartType
```

### Update platform

See the [Windows Upgrade Runbook](../runbooks/windows-upgrade-procedure.md).

---

## 12. Resource requirements

| Configuration                      | RAM                  | CPU       | Disk          |
| ---------------------------------- | -------------------- | --------- | ------------- |
| Single server (MSSQL on same host) | 16 GB                | 4 cores   | 100 GB SSD    |
| Single server (MSSQL offloaded)    | 8 GB                 | 2 cores   | 40 GB SSD     |
| Production (separate MSSQL server) | 8 GB + 16 GB (MSSQL) | 2+4 cores | 40+200 GB SSD |

These are minimum recommendations. Monitor memory and CPU; the platform is not memory-intensive but MSSQL benefits from RAM for the buffer pool.

---

## 13. Backup considerations

- **SQL Server backups**: Use SQL Server Agent jobs or Azure Backup for database backups. Enable point-in-time recovery via transaction log backups (recommended for production).
- **IIS configuration**: Export IIS config via `%windir%\system32\inetsrv\appcmd.exe list config > iis-backup.xml` and store alongside the application artifact.
- **Secrets**: Azure Key Vault has soft-delete enabled by default; purge protection is recommended.

---

## 14. Troubleshooting quick reference

| Symptom                   | First step                                                                      |
| ------------------------- | ------------------------------------------------------------------------------- |
| 502 Bad Gateway from IIS  | See [IIS 502 runbook](../runbooks/windows-iis-502-bad-gateway.md)               |
| Service won't start       | See [Service not starting runbook](../runbooks/windows-service-not-starting.md) |
| Certificate expired       | See [Certificate renewal runbook](../runbooks/windows-certificate-renewal.md)   |
| Key Vault access denied   | See [Key Vault access runbook](../runbooks/windows-azure-key-vault-access.md)   |
| MSSQL connection failure  | See [MSSQL connection runbook](../runbooks/windows-mssql-connection-issues.md)  |
| Service stops mid-request | See [Graceful shutdown runbook](../runbooks/windows-graceful-shutdown.md)       |

---

_This guide is reviewed and validated against a fresh Windows Server VM with each major platform release._
