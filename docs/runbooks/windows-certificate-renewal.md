# Runbook: Windows TLS Certificate Renewal

**Applies to:** IIS-hosted HTTPS endpoint
**Trigger:** Certificate expiry warning (< 30 days remaining) or expired certificate

---

## Step 1: Identify the expiring certificate

```powershell
# List all certificates in the Personal store with their expiry dates
Get-ChildItem Cert:\LocalMachine\My |
  Select-Object Subject, Thumbprint, NotAfter |
  Sort-Object NotAfter |
  Format-Table -AutoSize
```

Identify the certificate bound to IIS (matching the platform's hostname).

---

## Step 2a: Renew via win-acme (Let's Encrypt)

If the certificate was issued by Let's Encrypt via [win-acme](https://www.win-acme.com/), renewal is automatic. Verify:

```powershell
# win-acme installs a scheduled task named "win-acme renew (acme-v02.api.letsencrypt.org)"
Get-ScheduledTask -TaskName "win-acme*" | Select-Object TaskName, State, LastRunTime, NextRunTime
```

If the task is Disabled or has a past LastRunTime with an error:

```powershell
# Run renewal manually
& "C:\Program Files\win-acme\wacs.exe" --renew --baseuri "https://acme-v02.api.letsencrypt.org/"
```

Verify the new certificate is bound to IIS:

```powershell
# Should show the new (future) expiry date after renewal
Get-WebBinding -Name "Platform" -Protocol "https" |
  ForEach-Object {
    $hash = $_.certificateHash
    Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Thumbprint -eq $hash } |
      Select-Object Subject, NotAfter
  }
```

---

## Step 2b: Renew via a new PFX

If the certificate is managed by your organization's PKI (e.g., Active Directory Certificate Services):

1. Obtain the renewed PFX from your PKI team.
2. Run the bind script:

```powershell
powershell -ExecutionPolicy Bypass -File C:\Platform\deploy\iis\bind-certificate.ps1 `
  -CertPath "C:\certs\new-platform.pfx" `
  -CertPassword "pfx-password" `
  -SiteName "Platform" `
  -Hostname "platform.yourdomain.com"
```

3. Remove the old certificate from the store (optional, after verifying the new one works):

```powershell
Remove-Item Cert:\LocalMachine\My\<old-thumbprint>
```

---

## Step 3: Verify the new certificate is serving

```powershell
$req = [Net.HttpWebRequest]::Create("https://platform.yourdomain.com/_status")
$req.GetResponse() | Out-Null
$cert = $req.ServicePoint.Certificate
Write-Host "Issuer:  $($cert.Issuer)"
Write-Host "Expires: $($cert.GetExpirationDateString())"
```

---

## Step 4: Set up a renewal reminder

If auto-renewal isn't configured, add a calendar reminder at `NotAfter - 30 days`. Certificate expiry is a production outage risk.

Check current expiry:

```powershell
$binding = Get-WebBinding -Name "Platform" -Protocol "https"
$thumbprint = $binding.certificateHash
(Get-ChildItem Cert:\LocalMachine\My | Where-Object Thumbprint -eq $thumbprint).NotAfter
```
