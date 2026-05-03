# Runbook: Windows Platform Upgrade Procedure

**Options:**

- **In-place upgrade** (brief downtime, simpler)
- **Blue-green upgrade** (zero downtime, requires two servers or two service instances)

---

## Option A: In-place upgrade (with downtime)

Estimated downtime: 2–5 minutes for a typical release.

### Step 1: Announce maintenance window

Notify users and update the status page if applicable.

### Step 2: Download the new artifact

Download `platform-<new-version>.zip` from your CI artifact store or release page.

```powershell
# Example: download from Azure DevOps artifacts
# (adjust URL and credentials for your environment)
Invoke-WebRequest -Uri "https://dev.azure.com/<org>/<project>/_apis/build/builds/<buildId>/artifacts?artifactName=platform&api-version=7.1&$format=zip" `
  -OutFile "C:\Temp\platform-<new-version>.zip" `
  -Headers @{ Authorization = "Bearer <token>" }
```

### Step 3: Stop services

```powershell
Stop-Service "Platform Web" -Force
Stop-Service "Platform Worker" -Force
Write-Host "Services stopped at $(Get-Date)"
```

### Step 4: Back up current installation

```powershell
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item -Path "C:\Platform" -Destination "C:\Platform-backup-$timestamp" -Recurse
Write-Host "Backup at: C:\Platform-backup-$timestamp"
```

### Step 5: Extract new version

```powershell
Expand-Archive -Path "C:\Temp\platform-<new-version>.zip" -DestinationPath "C:\Platform" -Force
```

### Step 6: Run database migrations

```powershell
cd C:\Platform
node --enable-source-maps shared\migrate.mjs --adapter mssql
```

If migrations fail, see [Step 9: Rollback](#step-9-rollback-in-place).

### Step 7: Reinstall Windows services

The dist paths may have changed:

```powershell
cd C:\Platform\web
node --enable-source-maps scripts\uninstall-windows-service.mjs
node --enable-source-maps scripts\install-windows-service.mjs

cd C:\Platform\worker
node --enable-source-maps scripts\uninstall-windows-service.mjs
node --enable-source-maps scripts\install-windows-service.mjs
```

### Step 8: Verify

```powershell
Start-Sleep -Seconds 15
Invoke-WebRequest http://127.0.0.1:3000/_status -UseBasicParsing | Select-Object StatusCode, Content
# Expected: 200 with new version in Content
```

### Step 9: Rollback (in-place)

If the new version doesn't start:

```powershell
Stop-Service "Platform Web" -Force -ErrorAction SilentlyContinue
Stop-Service "Platform Worker" -Force -ErrorAction SilentlyContinue

Remove-Item C:\Platform -Recurse -Force
Move-Item C:\Platform-backup-<timestamp> C:\Platform

cd C:\Platform\web
node --enable-source-maps scripts\install-windows-service.mjs
cd C:\Platform\worker
node --enable-source-maps scripts\install-windows-service.mjs

Get-Service "Platform Web" | Select-Object Status
```

Note: rollback may require running the previous version's down-migration if the DB schema changed. Consult the release notes for migration reversibility.

---

## Option B: Blue-green upgrade (zero downtime)

Requires two servers (or two service instances on the same server using different ports). Use IIS ARR to shift traffic from the green (current) server to the blue (new) server.

1. Deploy the new version to the blue server using Option A steps 1–8.
2. Verify the blue server's `/_status` returns 200 and correct version.
3. In IIS ARR, update the upstream URL rewrite rule to point to the blue server's IP:port.
4. Monitor error rates and latency for 10–15 minutes.
5. If healthy: decomission or repurpose the green server.
6. If unhealthy: revert the IIS rewrite rule to the green server. No service interruption.

Detailed IIS ARR server farm configuration is beyond this runbook's scope; consult the Microsoft ARR documentation.
