# Windows Deployment Verification Checklist

Run this checklist after every Windows Server deployment (initial or upgrade).
Every item must be ✅ before the deployment is considered complete.

---

## Services

- [ ] `Platform Web` service is **Running** and **Start type: Automatic**

  ```powershell
  Get-Service "Platform Web" | Select-Object Name, Status, StartType
  ```

- [ ] `Platform Worker` service is **Running** and **Start type: Automatic**

  ```powershell
  Get-Service "Platform Worker" | Select-Object Name, Status, StartType
  ```

- [ ] Both services **restart after a manual kill** (test with `Stop-Process -Force -Name node` then wait 5 seconds)

---

## IIS / Network

- [ ] Public HTTPS endpoint returns 200:

  ```powershell
  (Invoke-WebRequest https://platform.yourdomain.com/_status).StatusCode
  # Expected: 200
  ```

- [ ] `/_status` response contains `"environment":"production"` and correct version

- [ ] HTTP redirects to HTTPS:

  ```powershell
  (Invoke-WebRequest http://platform.yourdomain.com/_status -MaximumRedirection 0 -ErrorAction SilentlyContinue).StatusCode
  # Expected: 301
  ```

- [ ] TLS certificate is valid and not near expiry (< 30 days):

  ```powershell
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $req = [Net.HttpWebRequest]::Create("https://platform.yourdomain.com/_status")
  $req.GetResponse() | Out-Null
  $req.ServicePoint.Certificate.GetExpirationDateString()
  ```

- [ ] `X-Forwarded-Proto: https` header present in Node logs (check log file, not IIS headers)

---

## Authentication

- [ ] Test sign-in via Entra ID completes without error and creates a user record in MSSQL

- [ ] (If WIA enabled) Sign in from a domain-joined browser without password prompt

---

## Logging

- [ ] Web app logs appear at `C:\Platform\logs\web\current.log`
- [ ] Worker logs appear at `C:\Platform\logs\worker\current.log`
- [ ] Event Log entries visible in **Windows Logs → Application** under source **Platform Web**
- [ ] Event Log entries visible under source **Platform Worker**

---

## Database

- [ ] MSSQL connection test from the app server:

  ```powershell
  # Uses sqlcmd; install via "choco install sqlcmd" if not present
  sqlcmd -S <sql-server-host> -U platform_user -P <password> -Q "SELECT TOP 1 name FROM sys.tables"
  ```

- [ ] CDC is enabled on the `platform` database:

  ```powershell
  sqlcmd -S <sql-server-host> -U platform_user -P <password> -Q "SELECT name, is_cdc_enabled FROM sys.databases WHERE name='platform'"
  # is_cdc_enabled should be 1
  ```

- [ ] SQL Server Agent is running:
  ```powershell
  (Get-Service "SQLSERVERAGENT").Status
  # Expected: Running
  ```

---

## Secret Management (if using Azure Key Vault)

- [ ] Platform reads secrets successfully at startup (no "Key Vault access denied" in logs)
- [ ] Verify by checking that `/_status` returns without errors (indicates DB connection succeeded, meaning DB credentials were read from Key Vault)

---

## Graceful shutdown

- [ ] `Stop-Service "Platform Web"` completes within 30 seconds without error
- [ ] No requests are dropped during stop (verify from IIS access logs — no 502/503 during the stop window)
- [ ] Service restarts cleanly after stop

---

## Post-deployment smoke test

```powershell
# Run the platform's built-in smoke test (if available)
cd C:\Platform
node --enable-source-maps shared\smoke-test.mjs --url https://platform.yourdomain.com
```

All checks must pass. Any failure must be resolved before sign-off.

---

\_Completed by: ******\_\_\_****** Date: ******\_\_\_****** Version: ******\_\_\_\_******
