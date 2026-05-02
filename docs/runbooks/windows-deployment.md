# Runbook: Windows Server Deployment

**Status:** Designed for, not yet exercised end-to-end.
This runbook documents the intended Windows Server + IIS deployment path.
It will be tested and validated when the first Windows customer engages.

---

## Architecture overview

On Windows Server, the platform runs as:

- **Node.js applications** (web app and worker) managed by **pm2** or **Windows Service Wrapper (winsw)**
- **IIS** as the reverse proxy (with ARR — Application Request Routing — and URL Rewrite)
- **SQL Server** as the database (using the `mssql` adapter)
- **Redis** via Docker Desktop or a Redis Windows binary

This is distinct from the Linux/Docker path but the application code is identical. The cross-platform guarantee (no Linux-isms in application code) means the same Node.js bundle runs on Windows without modification.

---

## Prerequisites

- Windows Server 2019 or 2022
- Node.js 22 LTS (x64) installed from nodejs.org
- pnpm 10+ installed
- IIS installed with ARR and URL Rewrite modules
- SQL Server 2019+ with a `platform` database and user
- (Optional) Docker Desktop for running Redis if not using a managed Redis

---

## Step 1: Install Node.js and pnpm

Download Node.js LTS from https://nodejs.org and install.

```powershell
node --version  # Should be 22.x.x
npm install -g pnpm
pnpm --version
```

---

## Step 2: Clone the repository

```powershell
cd C:\inetpub
git clone https://github.com/<org>/platform.git
cd platform
pnpm install --frozen-lockfile
```

---

## Step 3: Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

```
DATABASE_DRIVER=mssql
MSSQL_SERVER=localhost
MSSQL_DATABASE=platform_prod
MSSQL_USER=platform
MSSQL_PASSWORD=<strong-password>
IDENTITY_DRIVER=builtin   # or entra for enterprise
```

Note: `POSTGRES_URL` is not needed when `DATABASE_DRIVER=mssql`.

Validate:

```powershell
pnpm env:check
```

---

## Step 4: Build the application

```powershell
pnpm build
```

---

## Step 5: Run the web app as a Windows Service

Use [NSSM](https://nssm.cc/) or [winsw](https://github.com/winsw/winsw) to run the Node.js process as a Windows Service:

```powershell
# Using NSSM (example):
nssm install platform-web "node" "C:\inetpub\platform\apps\web\dist\server.js"
nssm set platform-web AppDirectory "C:\inetpub\platform"
nssm set platform-web AppEnvironmentExtra "NODE_ENV=production APP_ENV=production"
nssm start platform-web
```

The app listens on `PORT` (default: 3000).

---

## Step 6: Configure IIS as reverse proxy

1. Install IIS with ARR and URL Rewrite modules
2. Create a site for `dev.<DOMAIN>` (or `<DOMAIN>` for production)
3. Add a URL Rewrite rule to proxy to `http://localhost:3000`
4. For SSL, use IIS with a certificate from Let's Encrypt (win-acme tool) or your enterprise PKI

---

## Step 7: Run the worker

The worker also runs as a Windows Service:

```powershell
nssm install platform-worker "node" "C:\inetpub\platform\apps\worker\dist\index.js"
nssm set platform-worker AppDirectory "C:\inetpub\platform"
nssm start platform-worker
```

---

## Step 8: Verify

```powershell
Invoke-WebRequest http://localhost:3000/_status
```

Should return `ok: true` with `DATABASE_DRIVER=mssql` in the adapter list.

---

## Notes for future implementation

When validating this runbook against a real Windows Server:

1. Document any Windows-specific path issues (forward vs backslash)
2. Verify `node-windows` integration (Objective 9 covers Windows process management)
3. Test pm2 on Windows as an alternative to NSSM/winsw
4. Verify all shell scripts in `scripts/` work in PowerShell/Git Bash
5. Update this runbook with exact versions and any surprises

**Current status:** Application code is Windows-compatible (no Linux-isms). The deployment procedure has not been exercised on a real Windows Server. Treat this as a design guide until validated.
