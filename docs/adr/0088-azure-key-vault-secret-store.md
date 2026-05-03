# ADR-0088: Azure Key Vault as Optional Secret Store

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

The platform's default secret management is environment variables: database credentials, API keys, and signing secrets are set in the environment before the Node process starts. This works everywhere and requires no additional infrastructure.

Microsoft-house customers using Azure, however, have a preferred secret management tool: **Azure Key Vault**. Their security policies often require that secrets not appear in environment variables, OS-level config files, or deployment scripts — they should live in Key Vault and be read by the application at runtime. Azure AD managed identities make this zero-credential: the service running on an Azure VM reads Key Vault secrets without ever seeing a password.

The platform needs a `SecretStorePort` adapter that reads from Key Vault so these customers can use the platform without compromising their secret management practices.

## Decision

Implement the **`secret-azure-keyvault`** adapter, which implements `SecretStorePort`. The adapter:

1. Authenticates to Key Vault using `@azure/identity`'s `DefaultAzureCredential` chain: managed identity (for Azure VMs), environment credential, workload identity — whichever is available.
2. Reads all platform secrets from Key Vault at startup (cold lookup) and caches them for the process lifetime.
3. Exposes a `refresh()` method that re-reads all secrets from Key Vault; intended to be called before a service restart, not on a hot-reload basis.
4. Secrets that change during a service's lifetime require a restart to take effect (documented requirement). Hot secret rotation is a later enhancement.

The adapter is optional: if not configured, the platform falls back to reading secrets from environment variables (the default `SecretStorePort` implementation). Both can coexist: Key Vault provides production secrets; env vars provide local development overrides.

The secret names in Key Vault follow a `platform-<name>` convention (e.g., `platform-db-password`), configurable via a prefix setting.

## Consequences

### Positive

- Enables deployment to Azure with zero plaintext secrets in the deployment pipeline or OS configuration.
- Managed identity authentication means no credentials are needed to access Key Vault from an Azure VM — the service identity is managed by Azure AD.
- Integrates with existing Azure RBAC policies; granting/revoking the service's Key Vault access is one Azure portal operation.
- Satisfies common enterprise security compliance requirements (ISO 27001, SOC2) that prohibit plaintext secrets in environment variables.

### Negative

- Startup latency: Key Vault reads add ~50–200 ms to cold start (dependent on network; cached after first read).
- Key Vault is an Azure service; customers not on Azure cannot use this adapter. On-premise alternatives (HashiCorp Vault, CyberArk) require their own adapters.
- If Key Vault is unreachable at startup (network failure, permission issue), the service fails to start. The error message must be clear and actionable.
- Secret rotation requires a service restart; there is no live-reload. This is documented as a limitation.

### Neutral

- The `SecretStorePort` interface keeps the application code independent of the secret backend. Swapping from env vars to Key Vault requires only a configuration change, not code changes.
- On-premise customers without Azure can continue using environment variables. The Key Vault adapter is additive, not a replacement.

## Alternatives Considered

### Option A: HashiCorp Vault adapter

Implement against HashiCorp Vault's HTTP API instead of (or in addition to) Azure Key Vault.

**Deferred:** Some non-Azure Microsoft customers use HashiCorp Vault. A `secret-hashicorp-vault` adapter could be added as a future objective. The `SecretStorePort` abstraction makes this trivially additive — the application doesn't need to change. For Objective 9's focus on Azure/Microsoft-house deployments, Key Vault is the right first target.

### Option B: Windows Credential Manager / DPAPI

Use Windows Data Protection API (DPAPI) or Windows Credential Manager for local secrets.

**Rejected:** DPAPI is per-machine and per-user; secrets encrypted by one service account on one machine cannot be read by another. This makes clustered or blue-green deployments impossible. Key Vault is the correct choice for enterprise Windows deployments.

### Option C: Encrypted `.env` files with a master key in Key Vault

Store secrets in an encrypted file; read the decryption key from Key Vault at startup.

**Rejected:** Adds complexity (encrypted file format, key management for the encryption key) without meaningful benefit over reading secrets directly from Key Vault. Two-step secret resolution is harder to audit.

## References

- Objective 09: Cross-Platform Runtime (§5.7, §6.2)
- ADR-0084: Windows Server as First-Class Deployment Target
- [Azure Key Vault documentation](https://learn.microsoft.com/en-us/azure/key-vault/)
- [@azure/identity DefaultAzureCredential](https://learn.microsoft.com/en-us/javascript/api/@azure/identity/defaultazurecredential)
