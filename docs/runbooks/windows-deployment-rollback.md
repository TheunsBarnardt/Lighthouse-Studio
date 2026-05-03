# Runbook: Windows Deployment Rollback

**Use when:** A deployment has been applied but the new version is malfunctioning and must be reverted immediately.

This is a fast-path rollback. It assumes a backup was created during the upgrade (see [windows-upgrade-procedure.md](./windows-upgrade-procedure.md)).

---

## Step 1: Stop the broken services

```powershell
Stop-Service "Platform Web" -Force -ErrorAction SilentlyContinue
Stop-Service "Platform Worker" -Force -ErrorAction SilentlyContinue
Write-Host "Services stopped at $(Get-Date)"
```

---

## Step 2: Locate the backup

```powershell
Get-ChildItem C:\ -Filter "Platform-backup-*" | Sort-Object LastWriteTime -Descending | Select-Object -First 5
```

Identify the most recent backup that pre-dates the broken deployment. Note its full path.

---

## Step 3: Restore the backup

```powershell
$backupPath = "C:\Platform-backup-<timestamp>"  # Replace with actual path

Remove-Item C:\Platform -Recurse -Force
Move-Item -Path $backupPath -Destination C:\Platform
Write-Host "Restored from $backupPath"
```

---

## Step 4: Reinstall services (from restored version)

The service install may reference different paths in the restored version:

```powershell
cd C:\Platform\web
node --enable-source-maps scripts\install-windows-service.mjs

cd C:\Platform\worker
node --enable-source-maps scripts\install-windows-service.mjs
```

---

## Step 5: Verify the rollback

```powershell
Start-Sleep -Seconds 15
Invoke-WebRequest http://127.0.0.1:3000/_status -UseBasicParsing
# Expected: 200 with the previous version's version number
```

If the services still don't start, consult [windows-service-not-starting.md](./windows-service-not-starting.md).

---

## Step 6: Check database schema compatibility

If the broken deployment ran database migrations, the rolled-back code may be incompatible with the new schema.

Symptoms: DB errors in logs after rollback, not the same version as before deployment.

Resolution: Run the down-migration for the version that was deployed (consult release notes for reversibility). If migrations are not reversible, do not rollback — fix forward instead.

```powershell
cd C:\Platform
# List applied migrations
node --enable-source-maps shared\migrate.mjs --adapter mssql --status

# Roll back last migration (if supported)
node --enable-source-maps shared\migrate.mjs --adapter mssql --rollback
```

---

## Step 7: Post-rollback actions

1. Communicate the rollback to users and update the status page.
2. Preserve the failed deployment logs for postmortem:

```powershell
Copy-Item C:\Platform\logs C:\Temp\failed-deployment-logs-$(Get-Date -Format 'yyyyMMdd-HHmmss') -Recurse
```

3. Investigate the root cause before re-attempting the upgrade.
4. Ensure CI includes the failing test case before re-deploying.
