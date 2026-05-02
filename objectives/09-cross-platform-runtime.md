# Objective 9: Cross-Platform Runtime (Linux + Windows)

**Status:** Ready for development
**Prerequisites:** Objectives 1, 1.5, 2, 3, 4 family, 5, 6, 7, 8 complete
**Blocks:** Sale to any Microsoft house customer; production deployment in Windows-only environments

---

## 1. Purpose

Make the platform genuinely run on Windows Server, not just "designed for Windows." All previous objectives have applied cross-platform discipline — TypeScript scripts via `tsx` instead of bash, `path` module for file paths, no Linux-specific shell-isms — but until now Windows has been a theoretical target. This objective makes it real: an actual deployed installation running on Windows Server with IIS as the reverse proxy, MSSQL as the database, Azure DevOps as the CI/CD pipeline, and Entra ID as the identity provider.

The goal is not feature parity at the level of "looks the same on both" — Linux deployments using Coolify will always have a slicker DX. The goal is **functional parity**: every platform feature works correctly on Windows Server, with documented operational practices, runbooks, and CI verification.

This is the objective that makes the Microsoft-house thesis real. Without it, the platform's "we can run anywhere" claim is hypothetical. With it, the first Microsoft customer can be onboarded.

This objective produces no user-visible features. It produces **a verified Windows deployment story** plus the infrastructure to keep it working as the codebase evolves.

---

## 2. Scope

### In Scope

- Windows Server deployment topology: Web app on IIS, worker as Windows Service, MSSQL on dedicated server
- IIS configuration via `web.config` and `iisnode` (or Application Request Routing as reverse proxy)
- The web app running as a Node.js process behind IIS
- The worker running as a Windows Service via `node-windows` or equivalent
- Azure DevOps pipeline templates for build, test, deploy
- Entra ID as the default identity provider for Microsoft-house deployments
- Cross-platform test matrix in CI: tests run on both Linux and Windows runners
- Path handling: every filesystem operation is platform-correct
- Process management: graceful shutdown, restart, logging on both platforms
- Configuration sources: environment variables work identically; secrets via Azure Key Vault as an option for Windows deployments
- File system semantics: case sensitivity, line endings, file locking
- Time and timezone handling: consistent across platforms
- Network: Windows-specific concerns (firewall rules, named pipes for local IPC, WCF removed)
- Customer deployment guide for Windows
- Operational runbooks for Windows-specific issues
- ADRs

### Out of Scope (Belongs to Later Objectives or Customer Work)

- Customer-managed Active Directory integration beyond what Entra ID provides (deferred)
- Windows Server Failover Cluster setup (advanced operational topic; deferred)
- Group Policy deployment of the platform (a customer's IT department's concern; we provide the artifact, they package it)
- WSL-based "Linux on Windows" deployment — explicitly out of scope; we support native Windows
- macOS as a deployment target (developer machines yes; production no)
- Mobile platforms (out of scope generally)

---

## 3. Locked Decisions

| Decision                           | Choice                                                                                               | Rationale                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Supported Windows versions         | Windows Server 2019 and 2022                                                                         | Microsoft's currently supported server OSes                            |
| Node.js distribution on Windows    | Official Microsoft-signed Node 22 LTS MSI                                                            | Standard, signed, IT-approvable                                        |
| Web app hosting                    | Node.js process behind IIS as reverse proxy via Application Request Routing                          | More common in MS shops than `iisnode`; better-supported               |
| Worker hosting                     | Windows Service via `node-windows` package                                                           | Industry standard for long-running Node processes on Windows           |
| Process management                 | PM2 with `pm2-windows-service` integration as alternative                                            | For deployments where node-windows is too heavy                        |
| CI/CD on Windows                   | Azure DevOps Pipelines with self-hosted Windows agents in customer's network                         | Standard MS toolchain                                                  |
| Database (Microsoft house default) | MSSQL on a separate server (the persistence-mssql adapter handles this)                              | Already supported via Objective 4a                                     |
| Identity (Microsoft house default) | Entra ID via the identity-entra adapter                                                              | Already supported via Objective 5                                      |
| Storage (Microsoft house default)  | Azure Blob Storage via the storage-azure-blob adapter                                                | Aligns with Microsoft tooling; supported via Objective 5               |
| Secret management on Windows       | Environment variables (default) or Azure Key Vault (recommended for prod)                            | Compatible with Microsoft customer practices                           |
| Reverse proxy / TLS termination    | IIS handles TLS; Node app speaks plain HTTP on localhost                                             | Standard pattern; certificate management via IIS                       |
| Logging                            | stdout from Node process captured by Windows Service wrapper, written to event log + file            | Industry standard; integrates with Windows Event Log if customer wants |
| File paths                         | All path operations via Node's `path` module; no string concatenation with `/` or `\\`               | Already enforced via Objective 1; verified here                        |
| Line endings                       | LF in source files (enforced via `.gitattributes`); Windows-specific files (`.cmd`, `.ps1`) use CRLF | Already enforced; verified here                                        |
| File locking                       | Database-managed only; no filesystem-level locks                                                     | Cross-platform reliability                                             |
| Timezone storage                   | UTC everywhere; no reliance on system timezone                                                       | Already enforced; verified here                                        |
| CI matrix                          | Linux runner runs all tests; Windows runner runs platform-sensitive tests                            | Cost vs. coverage; Windows-specific tests are smaller subset           |

---

## 4. Architectural Overview

### 4.1 Reference Windows Deployment

```
┌──────────────────────────────────────────────────────────────────────┐
│                  Windows Server (e.g., 2 nodes)                       │
│                  Domain-joined; AD/Entra-integrated                    │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  IIS                                                                  │
│  - Bound to public TLS endpoint                                       │
│  - URL Rewrite + Application Request Routing (ARR)                   │
│  - Reverse-proxies to localhost:3000 (Node web app)                  │
│  - Handles certificate management                                     │
│  - Handles WAF rules (if customer has WAF appliance, integrates)     │
│           │                                                           │
│           ▼                                                           │
│  Node.js 22 LTS (web app)                                            │
│  - Runs as a Windows Service via node-windows                        │
│  - Listens on 127.0.0.1:3000                                         │
│  - Logs to Windows Event Log + file                                  │
│  - Connects to MSSQL on separate server                              │
│                                                                       │
│  Node.js 22 LTS (worker)                                             │
│  - Runs as a separate Windows Service                                │
│  - Connects to MSSQL                                                 │
│  - Reaches out to Anthropic API or Azure OpenAI                      │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              │ TDS over TLS
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    MSSQL Server (separate)                            │
│              Windows Server with SQL Server 2019/2022                 │
│              CDC enabled; FTS enabled; backups via SQL Agent          │
└──────────────────────────────────────────────────────────────────────┘

                              │
                              │ HTTPS (object storage)
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Azure Blob Storage                                  │
│                    (or on-premise MinIO; both supported)               │
└──────────────────────────────────────────────────────────────────────┘

                              │
                              │ OIDC
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                          Entra ID                                     │
│                    (customer's tenant)                                │
└──────────────────────────────────────────────────────────────────────┘

                              │
                              │ Build/Deploy
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Azure DevOps Pipelines                             │
│                    Self-hosted Windows agent                          │
│                    Builds Node app; tests; deploys via WinRM/SSH/    │
│                    XCopy to the Windows servers                       │
└──────────────────────────────────────────────────────────────────────┘
```

This is the customer's view: their existing Microsoft infrastructure, the platform plugged into it. The platform is a Node.js application; everything else is Microsoft-native.

### 4.2 Smaller Deployments

For smaller Microsoft customers, a single Windows Server can host:

- IIS + Node web app
- Node worker as a service
- MSSQL Express or Standard

Resource requirement: 16 GB RAM minimum, 8 GB if MSSQL is offloaded. Documented in the deployment guide.

### 4.3 Service Topology

Two Windows Services:

- `Platform Web` — Node.js web app process; restarts on failure; logs to file + Event Log
- `Platform Worker` — Node.js worker process; restarts on failure; logs to file + Event Log

Both services depend on the platform's MSSQL database being reachable. They're configured to start automatically after MSSQL.

---

## 5. The Hard Parts

**5.1 Path handling, file system semantics**

Cross-platform code that works in dev on macOS and breaks in production on Windows is a classic failure mode. The platform's discipline:

- Every path operation uses Node's `path.join`, `path.resolve`, etc. — never string concatenation with `/` or `\\`
- Forward slashes (`/`) used in URLs and storage keys (which are not file paths)
- Backslashes (`\\`) used only when explicitly Windows-targeted (e.g., a UNC path in a Windows-specific runbook)
- The shared utilities from Objective 1's `packages/shared/platform/paths.ts` (toPosix, fromPosix) handle conversion at storage boundaries

**Case sensitivity:**

- Windows filesystems are case-insensitive but case-preserving
- Linux filesystems are case-sensitive
- A file named `Component.tsx` works on both; a file named `component.tsx` (lowercase) referenced as `Component.tsx` works on Windows but fails on Linux
- Code review and the linter catch case-mismatched imports
- A CI check explicitly runs a build on Linux to catch case-sensitivity bugs early

**File locking:**

- Windows locks files when they're open; Linux generally doesn't
- The platform doesn't write to files that may be in use; logs use rotating files; uploads go to object storage
- The audit log writes are database-only, not filesystem
- Temporary files use `os.tmpdir()` and unique names

**5.2 Process management on Windows**

Linux uses systemd / Docker; Windows uses Services. The Node process needs to integrate as a Windows Service.

**Approach: `node-windows` package**

Wraps a Node script as a Windows Service. Provides:

- Auto-start on boot
- Auto-restart on crash (with backoff)
- Logging to Event Log
- Uninstall and reinstall via npm scripts

The platform's deployment package includes:

- `apps/web/install-windows-service.mjs` — installs `Platform Web` service
- `apps/worker/install-windows-service.mjs` — installs `Platform Worker` service
- Corresponding uninstall scripts

**Graceful shutdown on Windows:**

Windows sends `SERVICE_CONTROL_STOP` to services. `node-windows` translates this to a SIGTERM-equivalent. The application listens for the appropriate signal and:

- Stops accepting new requests / jobs
- Finishes in-flight requests / jobs
- Closes database connections cleanly
- Exits

The `gracefulShutdown` helper from cross-platform utilities handles this.

**5.3 IIS as reverse proxy**

IIS doesn't natively serve Node.js; we use it as a reverse proxy via Application Request Routing (ARR) and URL Rewrite.

**`web.config` template** (deployed alongside the app):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="ReverseProxyToNode" stopProcessing="true">
          <match url="(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:3000/{R:1}" />
        </rule>
      </rules>
    </rewrite>
    <httpProtocol>
      <customHeaders>
        <add name="X-Forwarded-Proto" value="https" />
      </customHeaders>
    </httpProtocol>
    <security>
      <requestFiltering>
        <requestLimits maxAllowedContentLength="10485760" /> <!-- 10 MB; configurable -->
      </requestFiltering>
    </security>
  </system.webServer>
</configuration>
```

ARR forwards client IP via `X-Forwarded-For`; the Node app trusts these headers (configurable). TLS terminates at IIS; the Node app sees plain HTTP on localhost.

**Customer deployment options:**

- ARR + URL Rewrite (recommended)
- `iisnode` (simpler in some setups but less actively maintained; documented as alternative)
- Front IIS with a different load balancer (HAProxy, nginx-on-Windows) and skip IIS entirely (for sophisticated customers; documented but not the default)

**5.4 Authentication on Windows: Entra ID + Windows Authentication**

For Microsoft houses, the default identity provider is Entra ID (already supported via Objective 5).

For deployments using Active Directory on-premises (not Entra), the platform supports:

- LDAP authentication via the OIDC adapter against an LDAP-bridging proxy (most cleanly via Active Directory Federation Services exposing OIDC)
- Or Windows Integrated Authentication (Kerberos/NTLM) via IIS, where IIS handles the auth handshake and forwards the authenticated principal to the Node app via headers

The Windows Integrated Authentication path requires a small adapter in the platform's identity layer (`identity-windows-integrated`) that trusts headers from IIS. This is added in this objective and conformance-tested.

The capability flag `windows_integrated_auth: true` indicates this adapter is in use; it requires that IIS be the only path to the Node app (otherwise headers can be spoofed).

**5.5 Logging integration with Windows Event Log**

Customer ops teams are accustomed to Windows Event Log. The platform integrates:

- Pino logger writes JSON to stdout (always)
- The Windows Service wrapper captures stdout
- A configurable transport writes structured events to Windows Event Log alongside the file log
- Event Log entries use the platform's event source (registered during install)

This way, the platform appears in standard Windows monitoring tools while still emitting structured logs for the OTel collector.

**5.6 Azure DevOps pipeline templates**

The platform ships `azure-pipelines/` directory with:

- `build.yml` — restore, install, build, test
- `deploy-staging.yml` — deploy to a staging Windows environment
- `deploy-production.yml` — deploy to production with manual approval gate

These templates are reference implementations. Each customer's Azure DevOps environment differs (variables, agents, secrets), but the templates make 80% of the work mechanical.

**Deployment mechanism:**

The pipeline produces a deployable artifact (a zip containing the Node app + node_modules + install scripts). Deployment to the target server uses:

- Azure DevOps Deployment Group (the customer's Windows server is registered as a deployment target)
- WinRM-based remote execution to install/update the Windows Service
- Or, for simpler setups, Web Deploy (msdeploy) for the IIS-hosted parts

Documented in the customer deployment guide.

**5.7 Azure Key Vault for secret management**

Microsoft customers often want secrets in Azure Key Vault rather than environment variables. The platform supports this via `secret-azure-keyvault` adapter implementing `SecretStorePort`.

The adapter resolves secrets at startup (cold lookup) and refreshes periodically. Secrets that change require a service restart; tested on Windows.

For customers using SQL Server's transparent data encryption, the platform's database connection still uses standard credentials managed via the secret store — TDE is below the application layer.

**5.8 The CI matrix on Windows**

Running CI on Windows costs more than Linux (slower runners, more setup). The pragmatic policy:

- **Linux CI** runs all tests on every PR (unit, integration, conformance, lint, type, build)
- **Windows CI** runs a focused subset on every PR:
  - Build (verifies cross-platform compilation)
  - Path-handling and platform-detection tests
  - Service install/uninstall scripts (smoke test)
  - End-to-end test: bring up web app + worker as Windows Services, hit a few endpoints, tear down
- **Windows nightly** runs the full suite on Windows
- **Windows on-release** runs the full suite plus a deployment dry-run

This catches Windows-specific regressions on every PR without doubling CI cost. Real Windows-only bugs are caught in nightly.

**5.9 Customer deployment guide**

A comprehensive document at `docs/deployments/windows.md` covering:

1. Prerequisites: OS versions, Node version, MSSQL version, Entra ID setup
2. Installing Node.js
3. Installing the platform: download release, extract, run install scripts
4. Configuring IIS: ARR setup, URL Rewrite rules, certificate binding
5. Configuring the Windows Services: install, configure to auto-start, set service account
6. Configuring environment variables / Key Vault
7. Configuring MSSQL: database creation, user creation with appropriate grants, CDC enable
8. Configuring Entra ID: app registration, redirect URIs, secret rotation
9. First-run verification: health checks, smoke tests
10. Day-2 operations: log locations, service restart, certificate renewal
11. Upgrade procedure: blue-green via service swap, or in-place with downtime
12. Backup considerations: SQL Server backups, IIS configuration backups
13. Troubleshooting: common issues with Windows-specific causes

This guide is the single most important deliverable for Microsoft-house sales. It's reviewed by Microsoft-experienced engineers before publishing.

**5.10 Common cross-platform bugs the linter catches**

The codebase already has discipline; the linter rules added in this objective specifically catch Windows-bound bugs that pass on Linux:

- **Path separator literals**: ESLint rule rejects `/` in string literals where `path.join` should be used
- **Hardcoded `/tmp`**: rule rejects in favor of `os.tmpdir()`
- **Shell-only commands**: rule rejects `child_process.exec('...')` calls unless explicitly cross-platform
- **Filesystem operations on absolute paths starting with `/`**: rule warns
- **Case-sensitive imports**: rule catches `import x from './Component'` when the file is `./component.tsx`
- **Process signals**: SIGUSR1, SIGUSR2, etc. that don't exist on Windows; rule warns

Existing tests pass on Linux; the linter is what catches cases that would fail on Windows before they reach Windows CI.

---

## 6. Component Specifications

### 6.1 Service Installation Scripts

`apps/web/scripts/install-windows-service.mts`:

```typescript
import { Service } from 'node-windows';
import path from 'node:path';

const svc = new Service({
  name: 'Platform Web',
  description: "The platform's web application",
  script: path.resolve('dist/server.js'),
  nodeOptions: ['--enable-source-maps', '--max-old-space-size=2048'],
  env: [
    // Critical env vars; rest come from .env or Key Vault
    { name: 'NODE_ENV', value: 'production' },
    { name: 'PLATFORM_HOME', value: 'C:\\Platform' },
  ],
  workingDirectory: 'C:\\Platform\\web',
  // Restart policy
  wait: 2,
  grow: 0.5,
  maxRestarts: 3,
});

svc.on('install', () => {
  console.log('Platform Web service installed; starting...');
  svc.start();
});

svc.on('error', (err) => {
  console.error('Service error:', err);
  process.exit(1);
});

svc.install();
```

Equivalent uninstall script. Both run with administrator rights (documented in deployment guide).

### 6.2 Windows-Specific Adapters

**`storage-azure-blob`** — already designed in Objective 1.5; implementation lands here for Microsoft-house deployments. Uses `@azure/storage-blob` SDK.

**`secret-azure-keyvault`** — implements `SecretStorePort` via `@azure/keyvault-secrets`. Authenticates via managed identity when running on Azure-managed VMs, or via service principal credentials otherwise.

**`identity-windows-integrated`** — trusts headers from IIS (specifically `LOGON_USER`, `AUTH_USER`, `HTTP_X_FORWARDED_USER`) and translates to a `VerifiedIdentity` for the platform. Capability declarations reflect what's possible (no MFA at this layer; relying on AD/Entra to enforce it upstream).

**`email-graph`** — sends email via Microsoft Graph API for customers using Exchange Online and wanting outbound from the platform's identity. Implements `EmailPort`.

### 6.3 IIS Configuration Templates

`deploy/iis/` directory contains:

- `web.config.template` — the reverse proxy configuration with `${VARIABLES}` for substitution
- `web.config.generate.mts` — script that produces `web.config` from the template + environment
- `setup-iis-arr.ps1` — PowerShell script to ensure ARR and URL Rewrite are installed on the IIS server
- `bind-certificate.ps1` — script to bind a TLS certificate (from a PFX or LetsEncrypt via win-acme)

These templates are exercised in CI via a Windows runner that brings up IIS, applies the configuration, and verifies the reverse proxy works.

### 6.4 Azure DevOps Pipeline Templates

`azure-pipelines/` directory:

```yaml
# azure-pipelines/build.yml
trigger:
  - main
  - develop
  - staging

pool:
  vmImage: windows-latest # or self-hosted Windows agent in customer's pool

variables:
  - name: NODE_VERSION
    value: '22.x'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: $(NODE_VERSION)

  - script: corepack enable && corepack prepare pnpm@9 --activate
    displayName: 'Setup pnpm'

  - script: pnpm install --frozen-lockfile
    displayName: 'Install dependencies'

  - script: pnpm typecheck
    displayName: 'Type check'

  - script: pnpm lint
    displayName: 'Lint'

  - script: pnpm test
    displayName: 'Unit + integration tests'

  - script: pnpm build
    displayName: 'Build'

  - task: ArchiveFiles@2
    inputs:
      rootFolderOrFile: '$(Build.SourcesDirectory)/dist'
      includeRootFolder: false
      archiveType: 'zip'
      archiveFile: '$(Build.ArtifactStagingDirectory)/platform-$(Build.BuildNumber).zip'

  - task: PublishBuildArtifacts@1
    inputs:
      pathToPublish: '$(Build.ArtifactStagingDirectory)'
      artifactName: 'platform'
```

Plus `deploy-staging.yml` and `deploy-production.yml` that download the build artifact and deploy via WinRM to target machines.

### 6.5 Cross-Platform Test Suite

A new test suite, `tests/cross-platform/`, contains tests that specifically exercise platform-sensitive code:

- **Path handling**: every utility in `packages/shared/platform/paths.ts` is tested with both Linux and Windows path inputs/outputs
- **Process signals**: graceful shutdown invoked via the appropriate signal per platform
- **File operations**: file creation, reading, deletion across platforms
- **Time and timezone**: timestamps round-trip correctly regardless of system timezone

These tests run on the Windows CI matrix on every PR.

### 6.6 Deployment Verification Checklist

A document at `docs/deployments/windows-verification.md` is the post-install checklist:

1. [ ] Both Windows Services are running and set to auto-start
2. [ ] IIS is serving the public domain with valid TLS
3. [ ] `/_status` endpoint returns 200 with correct environment info
4. [ ] Test sign-in via Entra works end-to-end
5. [ ] A test artifact creation succeeds
6. [ ] Logs appear in expected file locations
7. [ ] Logs appear in Windows Event Log under the platform's event source
8. [ ] Azure Key Vault (if used) is correctly read by the services
9. [ ] MSSQL CDC is enabled on watched tables
10. [ ] SQL Server Agent is running (required for CDC)
11. [ ] A graceful service stop completes within the configured timeout
12. [ ] After service restart, in-flight operations resume cleanly

The customer ops team runs this checklist as part of go-live.

### 6.7 Operational Runbooks

New files in `docs/runbooks/`:

- `windows-service-not-starting.md` — diagnostic for service start failures
- `windows-iis-502-bad-gateway.md` — when IIS can't reach the Node app
- `windows-event-log-troubleshooting.md` — finding platform events in Windows Event Log
- `windows-certificate-renewal.md` — renewing TLS certificates bound to IIS
- `windows-azure-key-vault-access.md` — managing Key Vault permissions for the service account
- `windows-upgrade-procedure.md` — blue-green and in-place upgrade procedures
- `windows-deployment-rollback.md` — reverting to a prior version
- `windows-mssql-connection-issues.md` — diagnosing connection failures (firewalls, encryption, auth)
- `windows-graceful-shutdown.md` — what happens during service stop, troubleshooting incomplete shutdowns

---

## 7. Implementation Order

1. **Set up a Windows Server VM for development** — Windows Server 2022, joined to a test domain, with MSSQL installed. Used for local validation of every later step.

2. **Install Node 22 LTS** on the Windows VM via the official MSI. Verify pnpm via corepack works.

3. **Build the platform on Windows** for the first time. Resolve any path-related, package-manager-related, or build-tool issues.

4. **Run the existing test suite on Windows.** Document and fix every failure that's actually a cross-platform bug (rather than a CI-environment-only issue).

5. **Implement the Windows Service installation scripts** for the web app and worker.

6. **Manually deploy the platform** to the Windows VM as a Windows Service. Verify it runs, accepts requests via localhost, logs to Event Log.

7. **Configure IIS** with ARR, URL Rewrite, and reverse-proxy to the Node app. Test public endpoint.

8. **Configure Entra ID** against a test tenant. Verify end-to-end sign-in.

9. **Implement the Windows Integrated Authentication adapter** (`identity-windows-integrated`).

10. **Implement the Azure Key Vault secret store adapter.**

11. **Implement the Microsoft Graph email adapter.** (Lower priority; can ship in a follow-up if time-constrained.)

12. **Implement the cross-platform test suite** with platform-sensitive tests.

13. **Set up the Windows CI matrix** in GitHub Actions: per-PR focused subset; nightly full suite.

14. **Write the customer deployment guide.** This is the highest-leverage deliverable.

15. **Write the Azure DevOps pipeline templates.**

16. **Run a deployment dry-run end-to-end** with a fresh Windows VM following the deployment guide. Note every gap; fix.

17. **Write all operational runbooks.**

18. **Run a chaos drill on Windows**: kill the service mid-operation, restart, verify recovery.

19. **Write ADRs.**

20. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0083: Windows Server Support as a First-Class Target** — what we commit to, what we don't, the customer thesis
- **ADR-0084: IIS as Reverse Proxy via ARR** — alternatives considered (iisnode, alternative reverse proxies), why ARR
- **ADR-0085: node-windows for Service Hosting** — alternatives (PM2, manual service install), why node-windows
- **ADR-0086: Windows Integrated Authentication via IIS Headers** — security model, what to trust, what not to
- **ADR-0087: Azure Key Vault as Optional Secret Store** — implementation strategy, when to use vs. env vars
- **ADR-0088: Cross-Platform Linter Rules** — which rules; what they catch; rationale

---

## 9. Verification Steps

1. **Fresh Windows VM** has the platform installed end-to-end following the deployment guide. Total time from clean OS to working platform: under 4 hours including reading.

2. **Both Windows Services run** — `Platform Web` and `Platform Worker` start automatically on boot, restart on crash within configured backoff.

3. **IIS reverse proxy works** — public HTTPS endpoint serves the platform; X-Forwarded-\* headers correctly populated; client IP visible in logs.

4. **TLS certificate** bound and valid; SSL Labs grade A.

5. **End-to-end sign-in via Entra** works; user record created in MSSQL via the User Directory adapter.

6. **Windows Integrated Authentication adapter** works — IIS configured for Windows Auth, headers passed through, platform accepts the principal.

7. **Azure Key Vault adapter** works — secrets read at startup, refreshed periodically, service restart picks up rotated secrets.

8. **Logs appear in three places**: stdout (captured by service), file rotation in configured directory, Windows Event Log under platform event source.

9. **Graceful shutdown** — issuing `Stop-Service Platform-Web` causes in-flight requests to complete within the timeout, no errors, then service stops cleanly.

10. **Worker service handles SIGINT-equivalent** correctly on Windows.

11. **MSSQL CDC working** — change events flow from MSSQL through the platform's change stream adapter.

12. **All foundation tests pass on the Windows CI runner** — the Windows-specific subset on every PR; full suite nightly.

13. **No path-related regressions** — running the existing test suite on Windows passes 100%.

14. **Linter rules catch a Windows-bound bug** — write code with `path.join('a', '/', 'b')` or `'/tmp/foo'`; lint fails.

15. **Azure DevOps pipeline runs** — the build template completes successfully against a real Azure DevOps project (test instance).

16. **Deployment dry-run** from CI artifact to a Windows VM via the deployment pipeline succeeds.

17. **Service install/uninstall** are clean — installing, uninstalling, and reinstalling the service multiple times doesn't leave residue (orphan registry entries, stale event log sources, etc.).

18. **Concurrency** — multiple service worker instances on the same Windows host can coexist (different ports, separate DBs ok).

19. **Cross-platform test suite** runs on both Linux and Windows; same suite, both pass.

20. **Customer deployment guide reviewed** by an experienced Windows engineer (internal or contracted); feedback incorporated.

If all 20 pass, the objective is met.

---

## 10. Definition of Done

**Runtime**

- [ ] Platform builds on Windows Server 2019 and 2022
- [ ] Both Windows Services install, start, restart, stop cleanly
- [ ] Graceful shutdown working on Windows
- [ ] Logs flow to file, stdout, and Windows Event Log

**IIS**

- [ ] Reverse proxy via ARR working
- [ ] `web.config` template and generation script
- [ ] PowerShell setup scripts for ARR and URL Rewrite
- [ ] Certificate binding documented and tested

**Adapters**

- [ ] `identity-windows-integrated` implemented and conformance-tested
- [ ] `secret-azure-keyvault` implemented and conformance-tested
- [ ] `storage-azure-blob` implemented and conformance-tested
- [ ] `email-graph` implemented (or explicitly deferred with rationale)

**CI**

- [ ] Windows CI matrix job runs on every PR (focused subset)
- [ ] Windows nightly job runs full suite
- [ ] Cross-platform test suite passes on both runners
- [ ] Linter rules catch Windows-bound bugs

**Azure DevOps**

- [ ] Pipeline templates committed in `azure-pipelines/`
- [ ] Build template tested against real Azure DevOps
- [ ] Deployment templates tested via dry-run

**Customer Deployment**

- [ ] Customer deployment guide written and reviewed
- [ ] Deployment verification checklist included
- [ ] Windows-specific runbooks complete
- [ ] Reference deployment (the dev VM) follows the guide successfully

**Verification**

- [ ] All 20 verification steps in Section 9 pass
- [ ] Chaos drill executed on Windows (kill service, verify recovery)
- [ ] Performance baseline: simple endpoint p95 < 100ms on Windows VM

**Documentation**

- [ ] ADRs 0083–0088 written and Accepted
- [ ] `docs/deployments/windows.md` complete
- [ ] All runbooks in Section 6.7 written

---

## 11. Anti-Patterns to Refuse

- **"It works on Linux, ship it; Windows can come later."** That's exactly the bug the cross-platform discipline prevents. Windows is a first-class target; "later" means never.
- **Hardcoded paths with `/` separators in code.** Linter catches.
- **Shelling out to bash-isms.** No `bash -c '...'`. Cross-platform Node code only.
- **Using `child_process.spawn('cmd', ['/c', ...])` directly.** Use the cross-platform `spawnCommand` helper from `packages/shared/platform/process.ts`.
- **Skipping the service-install scripts and "just running node directly."** That's what users do for dev. Production deploys are services.
- **Trusting IIS headers without configuration verification.** The Windows Integrated Auth adapter requires confirmation that IIS is the only path; otherwise headers are spoofable.
- **Skipping Windows CI because "it's slow."** Windows-specific bugs caught in production cost more than CI minutes.
- **Documenting "use WSL on Windows" as the install method.** No. Native Windows or document why we don't support a customer's environment.
- **Letting the deployment guide drift from reality.** Every release verifies the guide by running it. Drift catches up; verification prevents it.
- **Treating Azure DevOps templates as "examples"; not committing.** They're committed. Customers fork and adapt.
- **Service-install scripts that require manual configuration after running.** They don't. They produce a configured, running service. Edge cases (custom paths, etc.) are env-driven.

---

## 12. Open Questions for Confirmation Before Starting

1. **Self-hosted vs. Microsoft-managed deployment** — proposing native Windows Server only. Customers using Windows containers (Windows Server Containers / Process isolation) get a similar story but with Docker. Defer container-on-Windows to a later objective?

2. **`node-windows` vs. PM2** — node-windows is more native (registers as a service properly); PM2 is more featureful but heavier. Recommendation: node-windows as default; document PM2 as alternative.

3. **iisnode** — old Microsoft project, not actively maintained. Recommendation: don't recommend; document only as an alternative for customers already using it.

4. **Windows Server 2016 support** — proposing 2019 minimum. Windows Server 2016 is mainstream-supported until early 2027 but lacks some modern features. Confirm 2019+?

5. **Customer-managed AD on-premises** — do we support direct LDAP, or rely on the customer fronting AD with ADFS / Entra? Recommendation: rely on Entra/ADFS via OIDC. Document the LDAP path as out-of-scope for this objective; an `identity-ldap` adapter can be added if a customer pays for it.

6. **Deployment via Web Deploy (msdeploy) vs. WinRM-based file copy** — both work. Recommendation: WinRM-based for the pipeline templates; msdeploy as documented alternative.

7. **PowerShell scripts** — they're CRLF-line-ended (Windows convention) and signed by the platform release process. Confirmed?

---

## 13. What Comes Next

With Objective 9 complete, the platform genuinely runs on Windows Server. The Microsoft-house thesis is no longer hypothetical. Customers can deploy and operate the platform in their existing Microsoft infrastructure with documentation, tooling, and runbooks that match their team's expectations.

**Objective 10: Quality Gates Before Stage One** consolidates everything: load tests against the full foundation, penetration tests, chaos drills, accessibility baselines, the security checklist. This is the final verification that the foundation is ready for production load and feature work to begin in earnest.

After Objective 10:

- **The Data Management Module** begins — the Supabase-clone-for-any-database, with all foundation infrastructure in place beneath it
- **Stage 1 of the AI build pipeline (Intent Capture)** also begins — the first user-facing feature

Both can ship in parallel because they share a foundation that an enterprise security review wouldn't reject and a Microsoft-house IT team can deploy.

---

_This document is the contract. Every checkbox in Section 10 must be true before moving on._
