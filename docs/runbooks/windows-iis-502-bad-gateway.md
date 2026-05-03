# Runbook: IIS 502 Bad Gateway

**Symptom:** Requests to the platform return HTTP 502 from IIS. The browser shows "502 Bad Gateway" or "HTTP Error 502.3 - Bad Gateway".

A 502 means IIS received the request but couldn't forward it to the upstream Node app on `localhost:3000`.

---

## Step 1: Verify the Node service is running

```powershell
Get-Service "Platform Web" | Select-Object Name, Status
```

If status is not `Running`:

- See [windows-service-not-starting.md](./windows-service-not-starting.md)
- Start the service: `Start-Service "Platform Web"`

---

## Step 2: Test Node directly (bypass IIS)

```powershell
Invoke-WebRequest http://127.0.0.1:3000/_status -UseBasicParsing
```

- **Success (200):** Node is running but IIS can't reach it. Skip to Step 4.
- **Connection refused / timeout:** Node isn't listening. Restart the service (Step 1).

---

## Step 3: Check Node is listening on the correct address

```powershell
netstat -ano | findstr :3000
```

Expected output: a line with `127.0.0.1:3000` in `LISTENING` state.

If Node is listening on `0.0.0.0:3000` or `[::]:3000` but IIS can't reach it, check Windows Firewall isn't blocking loopback (unusual but possible with host-based firewalls).

If the port is wrong (e.g., app started on 3001), update the `web.config` to point to the correct port:

```powershell
cd C:\Platform
node deploy\iis\web.config.generate.mjs --port 3001 --output C:\inetpub\platform\web.config
iisreset
```

---

## Step 4: Check IIS ARR proxy is enabled

```powershell
# Check ARR proxy setting
C:\Windows\System32\inetsrv\appcmd.exe list config /section:system.webServer/proxy
```

If `enabled` is `false`:

1. Open IIS Manager
2. Click the server node (not a site)
3. Double-click **Application Request Routing Cache**
4. Click **Server Proxy Settings** in the Actions pane
5. Check **Enable proxy**
6. Click **Apply**

Or via PowerShell (run elevated):

```powershell
Set-WebConfigurationProperty -pspath 'MACHINE/WEBROOT/APPHOST' -filter "system.webServer/proxy" -name "enabled" -value "True"
iisreset
```

---

## Step 5: Verify web.config URL Rewrite rule

Open the `web.config` in the IIS site root:

```powershell
Get-Content C:\inetpub\platform\web.config
```

Verify the rewrite rule targets `http://127.0.0.1:3000/{R:1}`. If it points to a different port or host, regenerate:

```powershell
cd C:\Platform
node deploy\iis\web.config.generate.mjs --port 3000 --output C:\inetpub\platform\web.config
iisreset
```

---

## Step 6: Check IIS Failed Request Tracing

For detailed information on the 502:

1. In IIS Manager, click the site → **Failed Request Tracing Rules**
2. Enable tracing for 5xx status codes
3. Reproduce the 502
4. View the trace log at `%SystemDrive%\inetpub\logs\FailedReqLogFiles\`

The trace shows whether IIS is timing out (Node app too slow), or getting a connection refused.

---

## Step 7: Check Windows Firewall

Verify that IIS can connect to `127.0.0.1:3000` (loopback should not be blocked, but custom firewall software can interfere):

```powershell
Test-NetConnection -ComputerName 127.0.0.1 -Port 3000
```

Expected: `TcpTestSucceeded: True`.

---

## Step 8: iisreset as last resort

```powershell
iisreset
```

If this fixes the 502, the IIS application pool was in a bad state. Check for application pool recycling configuration that might be too aggressive.
