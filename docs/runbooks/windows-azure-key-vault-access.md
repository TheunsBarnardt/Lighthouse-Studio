# Runbook: Azure Key Vault Access Issues

**Symptom:** Platform service fails to start with "Key Vault access denied" or "Failed to fetch secrets from Azure Key Vault" in the logs.

---

## Step 1: Identify the error

```powershell
Get-EventLog -LogName Application -Source "Platform Web" -EntryType Error -Newest 10 |
  Format-List TimeGenerated, Message
```

Common error patterns:

| Error                               | Cause                                                                |
| ----------------------------------- | -------------------------------------------------------------------- |
| `AuthenticationRequiredError`       | No valid credential in the DefaultAzureCredential chain              |
| `RestError: Forbidden`              | Credential valid but lacks `Key Vault Secrets User` RBAC role        |
| `RestError: VaultNotFound`          | `KEY_VAULT_URI` environment variable points to a non-existent vault  |
| `ENOTFOUND <vault>.vault.azure.net` | DNS resolution failure — network/firewall issue                      |
| `ETIMEDOUT`                         | Key Vault endpoint unreachable — firewall blocking outbound port 443 |

---

## Step 2: Verify environment configuration

```powershell
# Check the env file
Select-String "KEY_VAULT" C:\Platform\.env
# Expected: KEY_VAULT_URI=https://your-vault.vault.azure.net
```

Open the vault URI in a browser (from the server) to verify it's reachable:

```powershell
Invoke-WebRequest -Uri "https://your-vault.vault.azure.net" -UseBasicParsing
# Should return 200 or 401 (not a connection error)
```

---

## Step 3: Check the managed identity / service principal

**If running on an Azure VM with managed identity:**

```powershell
# Test the IMDS (Instance Metadata Service) — confirms managed identity is enabled
Invoke-WebRequest -Uri "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://vault.azure.net" -Headers @{Metadata="true"} -UseBasicParsing
```

Expected: a JSON response with an `access_token`.

If this fails: managed identity is not enabled on this VM. Enable it in Azure Portal: **VM → Identity → System assigned → On → Save**.

**If using service principal credentials:**

```powershell
# Verify environment variables are set
$env:AZURE_CLIENT_ID
$env:AZURE_CLIENT_SECRET
$env:AZURE_TENANT_ID
```

All three must be set and non-empty.

---

## Step 4: Verify Key Vault RBAC

In Azure Portal, navigate to **Key Vault → Access control (IAM)**:

1. Check that the service's identity (managed identity name or service principal) has the **Key Vault Secrets User** role (or **Key Vault Secrets Officer** for read+write).
2. If missing, click **Add role assignment** → Role: `Key Vault Secrets User` → assign to the VM's managed identity or service principal.

Via Azure CLI (if available on a management machine):

```powershell
az keyvault show --name your-vault --query "properties.enableRbacAuthorization"
# Should be true
az role assignment list --scope "/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.KeyVault/vaults/<vault>" --assignee "<service-principal-id>"
```

---

## Step 5: Test secret read directly

```powershell
# Install Az module if not present: Install-Module Az.KeyVault
Connect-AzAccount -Identity   # Uses managed identity
Get-AzKeyVaultSecret -VaultName "your-vault" -Name "platform-db-password"
```

If this succeeds but the platform still fails, the issue is with how the Node process accesses credentials (check `AZURE_CLIENT_ID` etc. in the service environment, not just the current shell).

---

## Step 6: Restart after fixing

After fixing the credential/RBAC issue:

```powershell
Restart-Service "Platform Web"
Restart-Service "Platform Worker"
```

Watch the Event Log for a clean startup (no error entries in the first 30 seconds).
