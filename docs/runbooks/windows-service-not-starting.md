# Runbook: Windows Service Not Starting

**Applies to:** Platform Web, Platform Worker
**Symptom:** Service status is `Stopped` immediately after install or start command, or the service enters a `StartPending` loop.

---

## Step 1: Check the Event Log

The most detailed error is always in the Windows Event Log:

```powershell
Get-EventLog -LogName Application -Source "Platform Web" -Newest 20 | Format-List TimeGenerated, Message
# Or for Worker:
Get-EventLog -LogName Application -Source "Platform Worker" -Newest 20 | Format-List TimeGenerated, Message
```

Also check the System log for Service Control Manager entries:

```powershell
Get-EventLog -LogName System -Source "Service Control Manager" -Newest 20 | Where-Object { $_.Message -match "Platform" } | Format-List
```

---

## Step 2: Check the file log

node-windows writes its own wrapper log before the Node process starts:

```powershell
Get-Content "C:\Platform\logs\web\Platform Web.err.log" -Tail 50
Get-Content "C:\Platform\logs\web\Platform Web.out.log" -Tail 50
```

---

## Step 3: Test the script directly (not as service)

Run the Node script directly in a PowerShell window to see the error:

```powershell
cd C:\Platform\web
$env:NODE_ENV = "production"
$env:PLATFORM_HOME = "C:\Platform"
node --enable-source-maps dist\server.js
```

If the script exits immediately, the error appears in the console. Common causes:

| Error message                       | Cause                                       | Fix                                   |
| ----------------------------------- | ------------------------------------------- | ------------------------------------- | ----------------------------------- |
| `Cannot find module`                | Missing `node_modules` or bad `dist/` path  | Run `pnpm install`, rebuild           |
| `Error: EADDRINUSE :3000`           | Another process is on port 3000             | `netstat -ano                         | findstr :3000`; kill or reconfigure |
| `Error: connect ECONNREFUSED` on DB | SQL Server not reachable                    | See MSSQL runbook                     |
| `ENTRA_CLIENT_ID is required`       | Missing env var                             | Check `.env` file or Key Vault config |
| `Key Vault access denied`           | Managed identity or service principal issue | See Key Vault runbook                 |

---

## Step 4: Check service account permissions

If the service runs as a named account (not LocalSystem):

```powershell
$svc = Get-WmiObject -Class Win32_Service -Filter "Name='Platform Web'"
$svc.StartName   # Shows the account
```

Verify the account has:

- Read access to `C:\Platform\`
- Read access to the log directory `C:\Platform\logs\web\`
- Access to network shares or SQL Server if required

---

## Step 5: Reinstall the service

If the service install is corrupted (common after an aborted install):

```powershell
# Uninstall
cd C:\Platform\web
node --enable-source-maps scripts\uninstall-windows-service.mjs

# Remove residue if uninstall script fails
sc.exe delete "Platform Web"

# Reinstall
node --enable-source-maps scripts\install-windows-service.mjs
```

---

## Step 6: Check node-windows wrapper XML

node-windows creates a wrapper config alongside the script:

```
C:\Platform\web\dist\server.js.xml
```

Verify this file exists and contains the correct paths. If it references a stale path from a previous install location, delete it and reinstall the service.

---

## Escalation

If none of the above resolves the issue, collect:

1. Full Event Log output (steps 1–2 above)
2. Output of `node dist\server.js` run directly
3. The `server.js.xml` wrapper file contents
4. `node --version` and `pnpm --version`

Then open a support ticket.
