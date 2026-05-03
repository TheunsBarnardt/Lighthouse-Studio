# ADR-0086: node-windows for Windows Service Hosting

**Status:** Accepted
**Date:** 2026-05-03
**Deciders:** solo

## Context

The platform runs two long-lived Node.js processes on Windows: the web app and the worker. On Linux these run under systemd (or Docker). On Windows they need to run as Windows Services — the native mechanism for long-running background processes — so they:

1. Start automatically on boot (before any user logs in)
2. Restart on crash with configurable backoff
3. Log to the Windows Event Log (visible in standard Windows monitoring tools)
4. Respond to `sc stop` / `Stop-Service` commands with a graceful shutdown signal
5. Run as a named service account (not as SYSTEM or a logged-in user)

The question is which tool to use to register and manage the Node.js processes as Windows Services.

## Decision

Use **`node-windows`** to install, manage, and uninstall the Windows Services for both the web app and the worker.

Install scripts live at:

- `apps/web/scripts/install-windows-service.mts` — installs `Platform Web`
- `apps/worker/scripts/install-windows-service.mts` — installs `Platform Worker`
- Corresponding `uninstall-windows-service.mts` scripts for clean removal

Each service is configured with:

- Auto-restart with `wait: 2` seconds, `grow: 0.5` backoff, `maxRestarts: 3` (escalating delay)
- Logging to Event Log + a rotating file log under `PLATFORM_HOME\logs\`
- Environment variables forwarded via the service wrapper

Graceful shutdown: `node-windows` translates `SERVICE_CONTROL_STOP` to a SIGTERM-equivalent. The application listens on `process.on('SIGTERM', ...)` (already wired in the graceful-shutdown utility). Windows additionally requires listening on `SIGINT` for interactive processes; both handlers are registered.

**PM2 with `pm2-windows-service`** is documented as a supported alternative for customers who prefer it, but `node-windows` is the default in the deployment guide and in the install scripts.

## Consequences

### Positive

- `node-windows` produces a proper Windows Service that appears in `services.msc` and responds to standard `sc` commands.
- Event Log integration is built-in; no extra logging adapter needed for the service layer.
- Install/uninstall scripts are TypeScript (via `tsx`) — consistent with the platform's cross-platform scripting discipline.
- No external runtime required beyond Node.js itself; `node-windows` is an npm dependency.
- Restart behaviour is configurable per-environment via install script arguments.

### Negative

- `node-windows` requires administrator privileges to install/uninstall (documented in the deployment guide).
- The service wrapper creates XML configuration files alongside the script; these must be gitignored in production deployments.
- `node-windows` is a community package (not Microsoft-owned). It is well-maintained but carries the standard community-package risk.

### Neutral

- The `dist/server.js` and `dist/worker.js` scripts must be pre-built before the install scripts run; the deployment guide covers this.
- On uninstall, `node-windows` removes the registry entry and Event Log source cleanly if the stop/uninstall flow is followed.

## Alternatives Considered

### Option A: PM2 with pm2-windows-service

PM2 is a popular Node.js process manager. The `pm2-windows-service` package bridges PM2 and the Windows Service Control Manager.

**Not chosen as default:** PM2 adds a layer of indirection (PM2 runs as the Windows Service, PM2 manages the Node processes). This is powerful (process clustering, load balancing) but heavier than needed for the platform's two-process topology. PM2 is documented as a supported alternative for customers who want its features.

### Option B: nssm (Non-Sucking Service Manager)

NSSM is a third-party executable that wraps any application as a Windows Service. It's widely used in the Windows ecosystem.

**Rejected:** NSSM requires downloading and distributing an external executable alongside the platform. It's not an npm dependency, making it harder to manage in the deployment artifact. It also has no TypeScript API, so the install scripts would need to shell out to `nssm.exe`, breaking the cross-platform scripting discipline.

### Option C: winsw (Windows Service Wrapper)

Similar to NSSM — a Java-based tool from the Jenkins ecosystem that wraps a process as a Windows Service via an XML configuration file.

**Rejected:** Requires a JVM on the server (unusual for a pure Node.js deployment). The XML configuration is verbose and separate from the Node.js toolchain.

### Option D: Manual SC commands + batch scripts

Manually create a Windows Service via `sc create` with a batch file wrapper.

**Rejected:** Fragile, no restart policy, no Event Log integration beyond what the batch file explicitly wires. Not maintainable as a first-class deployment method.

## References

- Objective 09: Cross-Platform Runtime (§5.2, §6.1)
- ADR-0084: Windows Server as First-Class Deployment Target
- ADR-0085: IIS as Reverse Proxy via ARR
- [node-windows npm package](https://github.com/coreybutler/node-windows)
