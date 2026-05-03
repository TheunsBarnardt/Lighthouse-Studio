# Runbook: Windows Graceful Shutdown

**Purpose:** Explains what happens when the Platform Web or Worker service is stopped, and how to diagnose incomplete shutdowns.

---

## What happens during `Stop-Service`

1. Windows SCM sends `SERVICE_CONTROL_STOP` to the service.
2. `node-windows` translates this to a `SIGTERM` signal to the Node process.
3. The Node app's graceful shutdown handler:
   - Stops accepting new HTTP requests (web) / new jobs (worker)
   - Waits for in-flight requests/jobs to complete
   - Closes database connection pool
   - Exits with code 0
4. `node-windows` reports the service as stopped to SCM.

Default timeout: **30 seconds** (configurable). If the process doesn't exit within the timeout, SCM forcibly terminates it (code non-0).

---

## Checking shutdown logs

Graceful shutdown events appear in the application logs:

```powershell
# Event Log
Get-EventLog -LogName Application -Source "Platform Web" -Newest 20 |
  Where-Object { $_.Message -match "shutdown|SIGTERM|stop" } |
  Format-List TimeGenerated, Message

# File logs
Select-String "shutdown|SIGTERM|graceful" C:\Platform\logs\web\current.log | Select-Object -Last 20
```

A clean shutdown looks like:

```
[INFO] SIGTERM received; starting graceful shutdown
[INFO] HTTP server closed (no more connections)
[INFO] Database pool closed
[INFO] Exiting with code 0
```

---

## Diagnose an incomplete shutdown

### Symptom: Service takes > 30 seconds to stop

Likely cause: a long-running request or job is blocking the shutdown.

1. Check for in-flight requests at the time of shutdown in the access log:

```powershell
$stopTime = (Get-EventLog -LogName Application -Source "Platform Web" -Newest 5 |
  Where-Object { $_.Message -match "stop" } |
  Select-Object -First 1).TimeGenerated
# Look for requests that started before stopTime and hadn't completed
Get-Content C:\Platform\logs\web\access.log |
  Select-String "$($stopTime.ToString('HH:mm'))" | Select-Object -Last 30
```

2. The default request timeout is 25 seconds (within the SCM timeout window). Requests longer than 25 seconds force the connection to close. This is intentional.

### Symptom: Service forcibly terminated (exit code not 0)

The graceful shutdown handler didn't run or didn't complete. Check:

1. Is `process.on('SIGTERM', ...)` registered? (Should always be — it's in the core startup code.)
2. Is there an unhandled exception crashing the process before shutdown completes?

```powershell
Get-EventLog -LogName Application -Source "Platform Web" -EntryType Error -Newest 10 |
  Format-List TimeGenerated, Message
```

### Symptom: Service reports stopped but the process is still running

```powershell
Get-Process node | Format-Table Id, CPU, WorkingSet64
```

If node processes persist after the service shows Stopped, they're orphans from a previous failed stop. Kill them:

```powershell
Stop-Process -Name node -Force
```

---

## Manual graceful shutdown (without SCM)

For development or testing scenarios where you need to drain a running Node process:

```powershell
# Find the PID of the Platform Web Node process
$pid = (Get-Process node | Where-Object { $_.MainWindowTitle -match "Platform" -or $true } | Select-Object -First 1).Id

# Send SIGTERM equivalent via taskkill (Windows doesn't have kill -SIGTERM, but Node handles CTRL+C)
# For services, always use Stop-Service for proper SCM notification
Stop-Service "Platform Web"
```

---

## Increasing the shutdown timeout

If legitimate operations (long DB queries, large uploads) need more than 30 seconds:

Edit the install script and increase the `maxRetarts` wait period, then reinstall the service. Alternatively, configure the SCM timeout via registry (advanced; consult Windows documentation for `ServicesPipeTimeout`).
