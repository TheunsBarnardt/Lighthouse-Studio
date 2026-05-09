# Objective 36: IDE & CLI Surfaces

**Status:** Ready for development
**Prerequisites:** Objectives 19 (Public SDK), 20 (AI Pipeline Foundation), 33 (Skill Promotion), 34 (AI PR Review Surface), 35 (Eval & Replay Harness) complete; Objective 5 (Identity & Auth) for CLI/IDE auth flow
**Blocks:** None directly; productivity multiplier across the AI Build Pipeline and review surfaces

---

## 1. Purpose

The platform today assumes the web app as the primary surface. Generation, review, skill promotion, eval runs, trajectory inspection — all happen in the browser. This is correct as a starting point, but it imposes context-switching cost on the people most likely to use the platform daily: developers, who already live in editors and terminals. CodeRabbit demonstrates that meeting developers where they already work — IDE extensions, CLI tools — produces a meaningful productivity uplift.

Three surfaces here. Each is genuinely additive (they expose existing services; they don't reinvent), each consumes the existing public SDK from Objective 19 (the boundary already exists), and each is optional — the web app remains complete without them.

The first surface is the **CLI** (`lighthouse`). It exposes the major workflows of the platform — generate, review, replay, promote skill, run eval, list artifacts — as scriptable commands. Engineers automate; CI/CD systems integrate; remote workers use it without a browser.

The second surface is the **VS Code extension**. It surfaces review findings, eval results, and skill management in the editor. Developers don't leave the file they're editing to dismiss a finding or apply a suggestion.

The third surface is the **MCP server**. Model Context Protocol is the emerging standard for exposing services to AI harnesses. By shipping an MCP server, the platform becomes a context source for external agents (Hermes, Claude Code, Cursor) — the platform's PRDs, schemas, generated code, and skills become consumable context for any agent the customer chooses. This is the platform meeting external agents on neutral ground rather than competing with them.

---

## 2. Scope

### In Scope

- **CLI binary** (`lighthouse`): a Node-based CLI installable via npm; subcommands for generate, review, replay, promote-skill, list-artifacts, eval (per Obj 35), and admin operations
- **CLI auth**: device-code OAuth flow against the platform's identity service (Obj 5); credentials stored per-user in a standard config location; never in repo
- **CLI configuration**: per-workspace + per-app config in a standard `.lighthouse.json` file; honored when commands run inside a configured directory
- **VS Code extension**: official extension on the VS Code Marketplace; surfaces review findings inline, skill library, eval results, generation triggers
- **VS Code extension auth**: shares the CLI's credential store when present; falls back to its own device-code flow
- **MCP server**: a standalone process implementing Model Context Protocol; exposes a curated set of platform read operations as MCP tools; optional write operations gated by per-tool authorization
- **MCP authentication**: per-installation token issued by a workspace admin; revocable; audited
- **MCP tool curation**: a deliberate, conservative tool set — read PRD, read schema, read generated code, read skills, search artifacts, get review findings; no destructive operations at v1
- **Telemetry parity**: CLI and IDE produce the same audit events as web-app actions; the MCP server emits MCP-specific audit events
- **Self-update for CLI**: `lighthouse update` checks for new versions; prompts to update; never auto-updates
- **Cross-platform support**: Linux + Windows + macOS for CLI; VS Code extension runs anywhere VS Code does; MCP server runs Linux + Windows
- **Offline graceful degradation**: clear errors when commands require connectivity but the platform is unreachable
- ADRs

### Out of Scope (Belongs to Later Objectives or Explicitly Refused)

- **JetBrains / Cursor / Windsurf / Vim / Emacs extensions.** v1 ships VS Code only. Other IDE extensions require demand evidence and are tracked as separate objectives.
- **Mobile or web-IDE versions of the platform's UI.** The web app is the canonical UI; this objective is about local surfaces, not browser variants.
- **A "Cursor-equivalent" agentic IDE built by the platform.** Out of scope. The platform integrates with agentic IDEs via MCP rather than competing.
- **CLI commands for every web-app feature.** The CLI exposes the workflows engineers actually script. UI-only features (visual schema designer, design-token preview) stay in the web app.
- **Self-update auto-applying without user confirmation.** Always prompt.
- **MCP write operations beyond a small allowlist at v1.** Reads first; writes only after concrete demand and a careful authorization design.
- **MCP server hosted by the platform on customers' behalf.** Customers run their own MCP server pointed at their platform installation.
- **CLI as a way to bypass platform RBAC.** All CLI commands authorize identically to web-app actions.
- **Embedding the eval harness CLI into the main CLI's source tree.** They share the binary but the eval-specific subcommands (`lighthouse eval *`) are owned by Objective 35; this objective owns the rest.

---

## 3. Locked Decisions

| Decision                          | Choice                                                                                                                                      | Rationale                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| CLI distribution                  | npm package `@lighthouse-studio/cli`; `npx lighthouse <cmd>` works without install                                                          | Standard for Node CLIs; no separate installer pipeline |
| CLI minimum Node version          | Latest LTS at time of release; declared in `engines`                                                                                        | Predictable runtime                                    |
| CLI command framework             | `commander.js` (mature, lightweight, no surprises)                                                                                          | Avoids inventing a CLI framework                       |
| CLI output formats                | Default human-readable; `--json` flag for machine-readable; never both                                                                      | Scriptable when needed; readable by default            |
| CLI auth flow                     | OAuth 2.0 Device Code Grant against the platform's identity service                                                                         | Standard for CLIs; no credentials typed at the prompt  |
| CLI credential storage            | OS keychain when available (`keytar`); fallback to file at `~/.lighthouse/credentials.json` (`0600`)                                        | Secure where possible; portable everywhere             |
| CLI configuration discovery       | Walk up from cwd for `.lighthouse.json`; merge with `~/.lighthouse/config.json`; CLI flags override                                         | Works inside subdirectories                            |
| CLI versioning                    | Semver; major version aligned with platform major version                                                                                   | Customers running platform vN install CLI vN.x         |
| VS Code extension distribution    | Official VS Code Marketplace publication; signed; verified publisher                                                                        | Discoverability; trust                                 |
| VS Code extension API target      | VS Code 1.85+ (broad compatibility; no insider-only features)                                                                               | Supports most installs                                 |
| VS Code extension auth            | Reuses CLI credentials when present; otherwise its own Device Code flow                                                                     | One sign-in for users with both                        |
| VS Code extension feature surface | Review findings inline, skill library tree view, eval results, generation triggers, artifact search                                         | High-value workflows; no parity-with-web-app pressure  |
| MCP server distribution           | Same npm package; `lighthouse mcp serve` subcommand starts it                                                                               | One binary; one install                                |
| MCP server transport              | stdio (default for local agent integrations) and HTTP (for remote agents); both selectable per invocation                                   | Matches MCP norms                                      |
| MCP authentication                | Per-installation token, scope-bound to a workspace + a tool allowlist; issued by workspace admin via the web app                            | Clear authorization boundary; revocable                |
| MCP v1 tool surface               | Read-only: `read_prd`, `read_schema`, `read_design_tokens`, `read_generated_code`, `read_skills`, `search_artifacts`, `get_review_findings` | Conservative; reads can't break workspaces             |
| MCP write operations              | None at v1; explicitly deferred until a concrete demand emerges with a careful authorization design                                         | Anti-pattern: opening write surfaces speculatively     |
| MCP audit events                  | Every tool invocation audited with installation token + tool name + parameters (parameters redacted per the PII registry)                   | Same audit discipline as web app                       |
| Telemetry / usage analytics       | Anonymous opt-in usage telemetry (commands invoked, error rates); off by default; clear toggle                                              | Helpful for prioritization; respects privacy           |
| Self-update                       | `lighthouse update` checks the npm registry; never auto-applies; clearly differentiates breaking vs. non-breaking                           | User in control                                        |
| Authorization                     | New permissions: `cli.use` (default-on for all users), `mcp.issue_token` (workspace admin)                                                  | Per Objective 6 RBAC                                   |
| Cross-platform shell              | Bash-portable scripts; PowerShell scripts where Windows-specific (per Objective 9)                                                          | Consistent with cross-platform discipline              |
| MCP server runtime                | Same Node version as CLI; no separate runtime                                                                                               | Single dependency                                      |

---

## 4. Architectural Overview

```
┌──────────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────────┐
│         CLI              │    │   VS Code Extension      │    │      MCP Server          │
│  lighthouse <subcommand> │    │   (in editor)            │    │   (stdio or HTTP)        │
└────────────┬─────────────┘    └────────────┬─────────────┘    └────────────┬─────────────┘
             │                               │                               │
             │              ┌────────────────┴───────────────────────────────┘
             │              │
             ▼              ▼
        ┌────────────────────────────────────────┐
        │    Platform Public SDK (Objective 19)   │
        │      Promise-based; HTTP transport      │
        └─────────────────┬─────────────────────-─┘
                          │
                          ▼
        ┌────────────────────────────────────────┐
        │    Platform Services (web app uses     │
        │    the same boundary):                  │
        │    - GenerationService                  │
        │    - ArtifactService                    │
        │    - SkillService                       │
        │    - ReviewOrchestratorService          │
        │    - ReplayService / EvalRunService     │
        │    - AuthorizationPort                  │
        │    - AuditPort                          │
        └────────────────────────────────────────┘
```

All three surfaces consume the same SDK, which already enforces the platform's authorization, audit, and workspace-scoping discipline. This objective adds no new core services — only client surfaces.

---

## 5. The Hard Parts

**5.1 Auth that doesn't get in the way**

A CLI that asks for credentials on every command is unusable. A CLI that stores plaintext API keys is unsafe. The Device Code Grant flow is the right balance:

```
$ lighthouse login
  Visit https://platform.example.com/cli-login and enter the code: ABCD-1234
  Waiting for confirmation... done.
  Logged in as alice@example.com (workspace: acme).

$ lighthouse generate prd --intent "..."
  (uses stored credentials silently)
```

Credential storage:

- Try OS keychain (`keytar`): Keychain on macOS, Credential Manager on Windows, Secret Service on Linux.
- Fall back to a file at `~/.lighthouse/credentials.json` with `0600` permissions on POSIX, ACL-restricted on Windows.
- Refresh tokens used to extend sessions; access tokens short-lived.

The VS Code extension reads the same credential store when present. A user who runs `lighthouse login` doesn't sign in again in VS Code.

Multi-workspace support: a user belonging to multiple workspaces selects one as default; per-command override via `--workspace` flag.

**5.2 Configuration discovery and the `.lighthouse.json` file**

A developer in `~/projects/foo/apps/web/src/components/` running `lighthouse review run` shouldn't have to specify the workspace, the app, or the repo. The CLI walks up from cwd looking for `.lighthouse.json`:

```json
{
  "workspaceId": "ws_acme_prod",
  "appId": "app_dashboard",
  "platformUrl": "https://platform.example.com"
}
```

Discovery rules (locked):

- Walk up from cwd; first `.lighthouse.json` found wins.
- If none found, fall back to `~/.lighthouse/config.json` (per-user defaults).
- CLI flags always override discovered config.
- Discovered config is logged as a one-line "using config from <path>" on first command per session.

The `.lighthouse.json` is committed to the repo; teams get consistent CLI behavior automatically.

**5.3 Output formats and scripting**

A CLI with a single output format is either unreadable for humans or unparseable for scripts. The discipline:

- Default output: human-readable, colorized (off in non-TTY), structured for the command (a generation shows progress + artifact id + cost; a review shows finding counts + severity breakdown).
- `--json` flag: machine-readable JSON; stable schema versioned per command.
- `--quiet`: suppress non-essential output.

The JSON schema for each command is documented + tested. Schema changes are semver-aware: minor adds fields; major changes shape and triggers a CLI major version.

Scripts that pipe `--json` output to `jq` or PowerShell `ConvertFrom-Json` are first-class; the test suite includes pipe scenarios.

**5.4 The VS Code extension's value proposition**

The extension's job is to surface platform context where the developer already is, not to replicate the web app. Concretely:

- **Review findings inline**: a PR's review findings show as VS Code diagnostics (yellow/red squigglies) on the affected lines. Hovering shows the rationale + suggested fix. Quick-action `Apply suggestion` runs the same flow as the web-app button. Quick-action `Dismiss with reason...` opens an input box.
- **Skill library tree view**: a side panel listing the workspace's skills + pending candidates. Promote / dismiss / view template + version history.
- **Eval results browser**: a panel showing recent eval runs for the current prompt file (when editing one). Click a result to view the full structured report.
- **Generation triggers**: command-palette commands like "Lighthouse: Generate PRD section" invoke the platform's prompt orchestrators with the current file/selection as input. Output streams into a side panel.
- **Artifact search**: command-palette `Lighthouse: Find artifact...` searches across the workspace's artifacts; selecting opens the artifact in the panel.

The extension does _not_:

- Replace the schema designer.
- Re-implement the data browser.
- Provide deployment management.

Things that are visual or workflow-oriented stay in the web app. Things that intersect editing the code stay in the IDE.

**5.5 The MCP server's curation discipline**

MCP makes it tempting to expose every service. Resist. v1's tool list is deliberately small and read-only:

```
read_prd(app_id) → PRD content
read_schema(app_id) → schema definition
read_design_tokens(app_id) → token set
read_generated_code(app_id, file_path?) → generated code (file or full)
read_skills(applies_to_filter) → list of active skills (workspace + opted-in platform)
search_artifacts(query, filter) → matching artifacts
get_review_findings(repo, pr_number) → current findings for a PR
```

Why so few:

- **Read operations can't break workspaces.** Worst case: an external agent sees data it shouldn't (mitigated by per-installation scoping).
- **Write operations require careful authorization.** A write tool means an external agent could modify workspace state. The authorization model — what tokens can write, with what permissions, with what audit trail — needs deliberate design. v1 punts.
- **Tool count vs. usefulness**: each tool is documented, tested, and audited. A small set with high quality beats a large set with shallow coverage.

Token scoping: each MCP installation token specifies (workspace, allowed tools). A token issued for `read_prd, read_schema` cannot call `read_skills`. Tokens are revocable; revocation is immediate.

Tool invocations are audited: `mcp.tool_invoked` with installation token id, tool name, parameters (PII-redacted per Objective 7 registry). High-volume invocations are sampled.

**5.6 Distinct identities for different surfaces**

Audit clarity requires every action to attribute correctly:

- **Web app actions**: attributed to the user via session.
- **CLI actions**: attributed to the user whose credentials authenticated the CLI; surface = `cli`.
- **VS Code extension actions**: attributed to the user via shared credentials; surface = `ide_vscode`.
- **MCP tool calls**: attributed to the installation token (which has its own identity); surface = `mcp:<token-id>`.

The `surface` field in audit records lets dashboards distinguish where actions came from. Workspace admins can see "5,000 web app actions, 2,000 CLI invocations, 50 MCP tool calls this month" at a glance.

When debugging, the surface is often the most useful filter.

**5.7 Self-update without surprise**

`lighthouse update` checks the npm registry. The user always confirms before installing. The output explicitly distinguishes:

```
$ lighthouse update
  Current version: 1.4.2
  Latest version:  1.5.0 (minor; backward compatible)
  Release notes: https://...

  Install? [y/N]
```

Major version bumps are louder:

```
$ lighthouse update
  Current version: 1.5.3
  Latest version:  2.0.0 (MAJOR; may include breaking changes)

  Read the migration guide: https://...
  Confirm by typing the new version number: 2.0.0
```

Never auto-update silently. Never assume `y` on stdin redirection (require `--yes` flag for non-interactive contexts).

The CLI checks for updates at most once per day; a cached "latest known" version is shown on every command run as a quiet `(update available: 1.5.0)` footer. This is notification, not action.

**5.8 Telemetry: opt-in, anonymous, useful**

The platform team needs visibility into how the CLI is used: which commands are popular, which fail, how often errors occur. Without this, prioritization is guesswork.

The telemetry is:

- **Opt-in.** Off by default. First-run prompt asks the user; choice persisted.
- **Anonymous.** No workspace ids, no user ids, no file paths, no command parameters. Just: command name, exit code, duration, CLI version, OS/arch.
- **Aggregated.** Sent in batches, no individual command linkage.
- **Toggleable.** `lighthouse config telemetry off` at any time.
- **Documented.** What's collected is in the docs and surfaced on opt-in.

The same model applies to the VS Code extension. The MCP server emits no telemetry — its activity is fully captured in the platform's audit log already.

**5.9 Cross-platform reality**

Linux is primary; Windows is first-class (per AGENTS.md). For CLI/IDE/MCP:

- **Path handling**: `path.posix` for VCS-derived paths; `path` (default) for local file system. Tested on both.
- **Line endings**: Git's `core.autocrlf` settings are respected; CLI never normalizes content silently.
- **Shell scripts**: bundled scripts ship in `bin/posix/` and `bin/windows/`; the CLI selects at runtime.
- **Service registration**: when MCP server runs as a long-lived process, registration uses systemd on Linux, Windows Service on Windows (per Objective 9).
- **Keychain**: macOS Keychain, Windows Credential Manager, Linux Secret Service all supported via `keytar`.

CI runs the CLI test suite on Linux, Windows, macOS. The MCP server tests run on Linux and Windows.

**5.10 Offline and degraded-connectivity handling**

The CLI/IDE/MCP all require connectivity to the platform. Network failures are common; the discipline:

- **Clear errors**: "Cannot reach platform at <url>: connection refused. Check your network or platform availability."
- **No silent retries that hide problems**: retries happen at the SDK level (Obj 19) with bounded attempts; user-visible commands show the retry as a one-line status.
- **Cached read commands when reasonable**: `lighthouse artifact get <id>` after the first call caches for 5 minutes; subsequent reads work offline. The cache is honored only with explicit `--cached` flag to prevent stale-read confusion.
- **MCP server returns clear MCP error responses** when platform is unreachable; agents see typed errors, not hangs.

Long-running commands (`generate`, `eval run`) emit periodic progress; cancellation (Ctrl+C, IDE cancel button) is honored within 2 seconds.

---

## 6. Component Specifications

### 6.1 CLI command surface

```
lighthouse login                      # Device Code OAuth flow
lighthouse logout
lighthouse whoami                     # show current user + workspace

lighthouse workspace list
lighthouse workspace select <id>

lighthouse app list
lighthouse app config                 # show current .lighthouse.json + config

lighthouse artifact list [--stage] [--type] [--app]
lighthouse artifact get <id> [--json]
lighthouse artifact diff <id1> <id2>

lighthouse generate <prompt-id> --inputs <json-or-file> [--app <id>]
lighthouse generate intent --conversation <file>
lighthouse generate prd --from-intent <id>
lighthouse generate schema --from-prd <id>
# ... per-stage convenience commands

lighthouse review status <repo> <pr-number>
lighthouse review run <repo> <pr-number>
lighthouse review findings <repo> <pr-number> [--json]
lighthouse review dismiss <finding-id> --reason <text>
lighthouse review apply <finding-id>

lighthouse skill list [--scope workspace|platform]
lighthouse skill get <id>
lighthouse skill candidates [--pending]
lighthouse skill promote <candidate-id>
lighthouse skill retract <id> --reason <text>

lighthouse eval run <prompt-id> [--against <trajectory-id>] [--provider] [--model]   # Objective 35
lighthouse eval set list <prompt-id>                                                  # Objective 35
lighthouse eval determinism <prompt-id>                                               # Objective 35
lighthouse eval compare <prompt-id> --providers <p1>,<p2>                             # Objective 35
lighthouse eval promote <trajectory-id> --to-prompt <prompt-id>                       # Objective 35
lighthouse eval results <prompt-id> [--last <N>]                                      # Objective 35

lighthouse mcp serve [--transport stdio|http] [--port <n>] [--token <token>]
lighthouse mcp tokens list
lighthouse mcp tokens issue --workspace <id> --tools <comma-sep> [--label <text>]
lighthouse mcp tokens revoke <token-id>

lighthouse config get <key>
lighthouse config set <key> <value>
lighthouse config telemetry on|off

lighthouse update [--yes]
lighthouse version
```

Subcommands are grouped logically; `lighthouse --help` lists groups; `lighthouse <group> --help` lists commands within a group. Each command has a man-page-style help with examples.

### 6.2 CLI internal architecture

```
packages/cli-core/                    # shared CLI infrastructure (auth, config, output)
packages/cli/                          # main CLI binary; commander entrypoints
packages/cli-eval/                     # eval subcommands (owned by Objective 35)
packages/cli-mcp/                      # MCP server subcommand
```

All packages depend on the public SDK from Objective 19. None depends on `packages/core` directly — the CLI is a SDK consumer like any other client.

### 6.3 VS Code extension surface

Manifest: `apps/vscode-extension/package.json`

Activation events:

- On `*.ts` / `*.tsx` files inside a directory with `.lighthouse.json` ancestor.
- On command palette invocation of any `Lighthouse: ...` command.

Contributions:

- **Tree view**: `lighthouse-skills` (skill library), `lighthouse-reviews` (active reviews for the workspace).
- **Diagnostics**: review findings rendered as diagnostics on affected files.
- **Code actions**: `Apply suggestion` (when finding has high-confidence fix), `Dismiss finding...`.
- **Commands**:
  - `Lighthouse: Login` / `Logout`
  - `Lighthouse: Generate <stage>` (per-stage)
  - `Lighthouse: Find Artifact`
  - `Lighthouse: Open Skill Library`
  - `Lighthouse: Show Eval Results for current prompt`
  - `Lighthouse: Run review for current PR`

Settings:

- `lighthouse.platformUrl`
- `lighthouse.workspaceId`
- `lighthouse.useCliCredentials` (default true)
- `lighthouse.telemetry.enabled` (default false)

The extension re-uses `packages/cli-core` for auth and config — same credential store, same config discovery.

### 6.4 MCP server surface

```typescript
// packages/cli-mcp/src/server.ts

export class LighthouseMCPServer {
  start(transport: 'stdio' | 'http', options: ServerOptions): Promise<void>;
  stop(): Promise<void>;
}

// Tools registered with the MCP runtime:
const tools = [
  {
    name: 'read_prd',
    description: 'Read the PRD artifact for a given app',
    inputSchema: { app_id: 'string', section?: 'string' },
    handler: async (input, ctx) => { ... },
  },
  // ... all tools listed in Section 5.5
];
```

Tool execution path:

1. MCP request arrives with token (HTTP transport: Authorization header; stdio: handshake).
2. Token validated against `mcp_tokens` table; expired/revoked tokens rejected.
3. Tool name checked against token's allowlist.
4. Parameters validated against tool's input schema.
5. Authorization check via the platform's existing AuthorizationPort using the workspace + user-on-behalf-of bound to the token.
6. Service called via SDK.
7. Response shaped to MCP response format.
8. Audit `mcp.tool_invoked` event emitted.
9. Response returned.

### 6.5 Database Schema

Most state lives in services already. The new state is around MCP tokens and CLI sessions:

```typescript
mcp_installation_tokens: {
  ...standardColumns,
  workspace_id: uuid,
  issued_by_user_id: uuid,
  label: string,                                 // user-provided
  token_hash: char(64),                          // sha-256 of the token; never store the token itself
  allowed_tools: json,                           // string[]
  bind_to_user_id: uuid,                         // the user the token acts on behalf of
  status: enum('active', 'revoked'),
  last_used_at: timestamp?,
  revoked_at: timestamp?,
  revoked_by_user_id: uuid?,
  expires_at: timestamp?,                        // optional expiry
}
indexes: [workspace_id, status], [token_hash UNIQUE]

cli_sessions: {
  ...standardColumns,
  user_id: uuid,
  device_code_used: string,                      // hashed device code
  refresh_token_hash: char(64),
  surface: enum('cli', 'ide_vscode'),
  user_agent: string,                            // OS/arch/CLI-version
  status: enum('active', 'revoked'),
  last_used_at: timestamp,
  revoked_at: timestamp?,
}
indexes: [user_id, status], [refresh_token_hash UNIQUE]
```

Existing audit + identity tables get a `surface` column extension to record where an action originated (web, cli, ide_vscode, mcp).

### 6.6 Audit Events

```
cli.login
cli.logout
cli.session_revoked
cli.command_invoked (sampled; high-volume; only when telemetry-disabled mode requires no audit)
cli.update_check
cli.update_applied

ide.activated
ide.command_invoked

mcp.token_issued
mcp.token_revoked
mcp.server_started
mcp.tool_invoked
mcp.tool_invocation_denied
mcp.transport_error
```

Note: `cli.command_invoked` and `ide.command_invoked` are not audited individually (too high-volume). Audit happens at the underlying service level (the same audit web-app actions produce). The `surface` column on those audit events captures origin.

### 6.7 Observability

```
platform_cli_logins_total{surface}                        — counter
platform_cli_active_sessions{surface}                      — gauge
platform_cli_command_invocations_total{command, status}    — counter (telemetry-derived; opt-in)
platform_cli_update_checks_total                            — counter
platform_cli_errors_total{kind}                             — counter

platform_ide_active_users                                   — gauge

platform_mcp_servers_running                                — gauge
platform_mcp_tool_invocations_total{tool, status}          — counter
platform_mcp_tool_duration_seconds{tool}                    — histogram
platform_mcp_tokens_active{workspace}                       — gauge
platform_mcp_tokens_revoked_total                           — counter
platform_mcp_unauthorized_attempts_total                    — counter
```

### 6.8 Operational Runbooks

New files in `docs/runbooks/`:

- `cli-auth-failure.md` — login flow stuck; credential store troubleshooting per OS.
- `mcp-token-leak.md` — suspected MCP token exposure; revocation + audit review.
- `vscode-extension-update.md` — extension publication procedure; rolling back a bad version.
- `cli-update-rollback.md` — user installed a bad CLI version; downgrade procedure.
- `mcp-server-resource-exhaustion.md` — agent spamming MCP tools; rate limiting + token suspension.
- `keychain-unavailable.md` — keychain backend missing on Linux; falling back to file storage.

---

## 7. Implementation Order

1. **`packages/cli-core`** — auth (Device Code), config discovery, output formatting, error handling.
2. **`packages/cli`** — main binary; commander setup; trivial commands (`login`, `logout`, `whoami`, `version`).
3. **CLI auth flow end-to-end** — Device Code grant against the platform's identity service; credential storage.
4. **CLI workspace + app commands** — `workspace list/select`, `app list/config`.
5. **CLI artifact commands** — `artifact list/get/diff`.
6. **CLI generate commands** — invoke prompt orchestrators via SDK; streaming output.
7. **CLI review commands** — status, run, findings, dismiss, apply.
8. **CLI skill commands** — list, get, candidates, promote, retract.
9. **`mcp_installation_tokens` + `cli_sessions` schema migrations** on all three databases.
10. **MCP server** — `lighthouse mcp serve`; stdio transport first; HTTP second.
11. **MCP tool implementations** — the 7 read tools listed in Section 5.5.
12. **MCP token issuance + revocation** — `lighthouse mcp tokens issue/revoke`; web-app UI for issuing tokens.
13. **VS Code extension scaffold** — package, manifest, activation, settings.
14. **VS Code shared auth** — read CLI credentials when present.
15. **VS Code review findings as diagnostics** + code actions.
16. **VS Code skill library tree view**.
17. **VS Code generation commands** with streaming output panel.
18. **VS Code eval results browser** for currently-edited prompt files.
19. **Telemetry plumbing** (opt-in, anonymous) for CLI + IDE.
20. **Self-update** for CLI.
21. **Cross-platform CI matrix** — Linux + Windows + macOS for CLI; Linux + Windows for MCP.
22. **VS Code Marketplace publication** — signed extension; verified publisher.
23. **Documentation** — ADRs, runbooks, CLI reference, MCP integration guide, VS Code extension guide.
24. **Verify Definition of Done.**

---

## 8. ADRs to Write

- **ADR-0309: CLI Distribution via npm** — why npm vs. binary downloads; cross-platform consequences.
- **ADR-0310: Device Code OAuth for CLI Auth** — chosen flow vs. PKCE-with-browser-redirect; UX trade-offs.
- **ADR-0311: Configuration Discovery via Walk-Up `.lighthouse.json`** — why this convention; precedent in other tools.
- **ADR-0312: VS Code as v1 IDE; Other IDEs Deferred** — demand-driven addition policy.
- **ADR-0313: MCP v1 Read-Only Tool Surface** — why no writes at v1; the careful-authorization-design that writes will need.
- **ADR-0314: MCP Per-Installation Token with Tool Allowlist** — token scoping model.
- **ADR-0315: Surface Field on Audit Records** — extending audit attribution to distinguish web/cli/ide/mcp.
- **ADR-0316: Telemetry Opt-In, Anonymous, Toggleable** — what's collected; how aggregated; retention.
- **ADR-0317: Self-Update User-Confirmed Always** — never silent; major-bump confirmation by typing version.
- **ADR-0318: Shared Credential Store Across CLI + IDE** — one sign-in for users with both.

---

## 9. Verification Steps

1. **CLI install** — `npm i -g @lighthouse-studio/cli`; `lighthouse --version` prints version.
2. **CLI login** — `lighthouse login` prints a code + URL; entering the code in browser completes auth; credentials stored.
3. **CLI login (no keychain)** — Linux without Secret Service; falls back to file with `0600`; warning printed.
4. **CLI whoami** — returns the authenticated user + current workspace.
5. **CLI workspace switch** — select different workspace; subsequent commands use it.
6. **CLI config discovery** — `cd subdir && lighthouse app config` finds ancestor `.lighthouse.json`; reports its path.
7. **CLI flag overrides config** — `--workspace <other>` overrides discovered config.
8. **CLI artifact list with `--json`** — output is valid JSON; matches documented schema.
9. **CLI generate with streaming** — output streams progressively; cost reported at end.
10. **CLI review run** — runs a review against a real PR; returns finding counts.
11. **CLI review findings + dismiss** — list findings; dismiss one with reason; SkillCandidate created (Obj 33 verification).
12. **CLI skill promote** — promote a pending candidate; new skill appears at version 1.0.0.
13. **CLI eval commands** — `eval run`, `eval determinism`, `eval promote` execute (per Obj 35 verification).
14. **CLI offline error** — platform unreachable; clear error message; non-zero exit.
15. **CLI cached read** — `lighthouse artifact get <id>` cached for 5 minutes; `--cached` flag honors.
16. **CLI Ctrl+C** — long-running command cancels within 2 seconds; partial state cleaned up.
17. **CLI self-update** — newer version available; prompt; `--yes` flag installs without prompt; major bump requires version typed.
18. **CLI cross-platform** — same commands run on Linux, Windows, macOS; CI matrix passes.
19. **MCP server start (stdio)** — `lighthouse mcp serve --transport stdio --token <t>` starts; responds to MCP handshake.
20. **MCP server start (HTTP)** — `lighthouse mcp serve --transport http --port 8765`; HTTP request with Bearer token gets MCP response.
21. **MCP tool invocation** — `read_prd` returns the PRD artifact; audit `mcp.tool_invoked` emitted.
22. **MCP tool not in allowlist** — token allows `read_prd` only; calling `read_skills` returns MCP error; audit `mcp.tool_invocation_denied`.
23. **MCP token revocation** — admin revokes; subsequent invocations rejected; immediate effect.
24. **MCP authorization** — token's bound user lacks permission for an artifact; tool returns Forbidden via MCP error.
25. **VS Code extension activation** — open a project with `.lighthouse.json`; extension activates; tree views populated.
26. **VS Code shared credentials** — CLI logged in; extension uses same credentials without re-login.
27. **VS Code findings as diagnostics** — review with findings exists; opening a file with finding shows diagnostic + hover + code action.
28. **VS Code apply suggestion** — code action `Apply suggestion` triggers platform; bot commit appears on PR; finding lifecycle updates.
29. **VS Code skill promote** — tree view candidate; right-click promote; new skill appears.
30. **Telemetry off by default** — fresh CLI install; no telemetry events emitted; opting in starts emission.
31. **Audit surface attribution** — CLI command produces audit event with `surface: 'cli'`; web action produces `surface: 'web'`; MCP produces `surface: 'mcp:<token-id>'`.
32. **Cross-database conformance** — mcp_installation_tokens, cli_sessions work identically on Postgres, MSSQL, Mongo.
33. **VS Code Marketplace install** — extension installable from the Marketplace by ID; signature verifies.

If all 33 pass, the objective is met.

---

## 10. Definition of Done

**CLI**

- [ ] `@lighthouse-studio/cli` published to npm
- [ ] `commander.js` command structure with help text + examples
- [ ] Device Code OAuth login flow
- [ ] Credential storage via keychain with file fallback
- [ ] `.lighthouse.json` config discovery
- [ ] `--json` flag on every read command with documented schema
- [ ] All command groups implemented (workspace, app, artifact, generate, review, skill, eval, mcp, config, update)
- [ ] Streaming output for long-running commands
- [ ] Ctrl+C cancellation within 2 seconds
- [ ] Cached reads (5min TTL) with `--cached` flag
- [ ] Self-update with confirmation discipline
- [ ] Cross-platform: Linux, Windows, macOS

**VS Code Extension**

- [ ] Manifest published to Marketplace; signed; verified publisher
- [ ] Activation on `.lighthouse.json`-rooted projects + command palette
- [ ] Shared credential store with CLI
- [ ] Findings as diagnostics + hovers + code actions
- [ ] Skill library tree view with promote/dismiss
- [ ] Eval results browser for prompt files
- [ ] Per-stage generation commands with streaming output
- [ ] Artifact search via command palette

**MCP Server**

- [ ] `lighthouse mcp serve` subcommand
- [ ] stdio transport
- [ ] HTTP transport with Bearer auth
- [ ] 7 read-only tools (read_prd, read_schema, read_design_tokens, read_generated_code, read_skills, search_artifacts, get_review_findings)
- [ ] Per-tool input schema validation
- [ ] Token allowlist enforcement
- [ ] Authorization via existing AuthorizationPort
- [ ] PII redaction in tool responses where applicable
- [ ] Audit events on every invocation

**Authentication**

- [ ] OAuth Device Code Grant against identity service
- [ ] Refresh token rotation
- [ ] MCP per-installation token issuance via web app
- [ ] Token revocation propagates immediately
- [ ] Bound-user model for MCP tokens

**Database Schema**

- [ ] mcp_installation_tokens + cli_sessions migrated on all three databases
- [ ] `surface` column extension on audit records

**Telemetry**

- [ ] Opt-in toggle; off by default
- [ ] Anonymous + aggregated
- [ ] Documented + transparent

**Authorization**

- [ ] `cli.use` (default-on) permission
- [ ] `mcp.issue_token` (workspace admin) permission
- [ ] All commands authorize via the platform's RBAC

**Documentation**

- [ ] ADRs 0309–0318 written and Accepted
- [ ] All runbooks in Section 6.8 written
- [ ] CLI reference (per-command help)
- [ ] MCP integration guide (for external agent authors)
- [ ] VS Code extension guide

**Cross-Platform**

- [ ] CI matrix: CLI tests on Linux, Windows, macOS
- [ ] CI: MCP server tests on Linux + Windows

**Verification**

- [ ] All 33 verification steps in Section 9 pass

---

## 11. Anti-Patterns to Refuse

- **Auto-updating the CLI without user confirmation.** Always prompt. Major bumps require typed confirmation.
- **Storing credentials in repo files or environment variables in shell history.** Keychain or `0600` config; never anywhere a `cat` could expose them.
- **Exposing every platform service through MCP.** Read-only at v1; writes require deliberate authorization design.
- **Custom protocol for IDE/CLI/MCP instead of the SDK.** All three consume the SDK; one boundary, one auth, one audit story.
- **Replicating the web app in the IDE.** Workflow integration only; visual tools stay in the web app.
- **Telemetry enabled by default.** Opt-in always.
- **Telemetry that records workspace ids, file paths, or command parameters.** Anonymous and aggregated only.
- **Silent retries hiding network failures.** Surface them; let the user decide.
- **MCP tokens with implicit "all tools" scope.** Allowlist required at issuance; default empty.
- **MCP tokens that survive workspace revocation.** Revoking a workspace revokes all its tokens.
- **A "Cursor-equivalent" agentic IDE built into the platform.** Out of scope; integrate via MCP.
- **VS Code-only thinking.** The MCP server is the integration point for non-VS-Code IDEs; don't build the IDE features so deeply that other IDEs become impossible.

---

## 12. Open Questions for Confirmation Before Starting

1. **CLI distribution as npm only at v1** — vs. shipping standalone binaries via Homebrew / Scoop / `apt`. npm is simplest; binary distribution adds discovery channels. Acceptable to start npm-only?
2. **VS Code extension only at v1** — JetBrains is the obvious next IDE; Cursor + Windsurf use VS Code's extension API so they may "just work" via the same extension. Demand-driven additions confirmed?
3. **MCP HTTP transport at v1** — adds attack surface (a listening port) that stdio doesn't have. Some agents need HTTP. Worth shipping both, or start stdio-only and add HTTP on demand?
4. **MCP write tools** — definitely deferred per locked decision. But there's a narrower question: would the platform team like a v1.5 mini-objective to design write authorization, or wait until concrete demand?
5. **Telemetry data retention** — proposing 90 days for raw events, 1 year for aggregates. Acceptable?
6. **Self-update channel** — npm registry only? Or also a "stable / beta / nightly" track? Proposing single track aligned with platform releases.
7. **MCP token expiry default** — proposing no default expiry; admin sets explicitly. Some teams would prefer mandatory 90-day expiry. Workspace setting either way?

---

## 13. What Comes Next

With Objective 36 complete, the platform's surfaces match where developers actually work: the web app for visual workflows, the CLI for scripting and automation, the IDE extension for in-context productivity, and MCP for external agent integration. The platform stops being a destination and becomes context that flows to wherever the work happens.

This is the last objective in the addon set proposed by the planning round (33–36). The full set delivers:

- **Procedural memory** (Obj 33): the platform learns from approved generations.
- **AI PR review** (Obj 34): every PR gets contextually-tuned review.
- **Eval discipline** (Obj 35): prompt iteration is gated by real-data regressions.
- **Local surfaces** (Obj 36): developers don't context-switch.

Combined, the platform is no longer just a generator — it is a generator with memory, judgment about its own outputs, an automated reviewer, and a presence in the developer's editor. The trajectory from "Supabase equivalent + AI build pipeline" to "engineering collaborator that ships with the platform" closes meaningfully here.

Future objectives noted in the plan but not authored in this batch: Obj 32 extension (continuous post-deploy scanning), Obj 30 extension (AutoFix loop), Obj 31 extension (compliance framework mapping). These are notes for revision rather than new top-level objectives, per the addon plan.

---

_This document is the contract. Every checkbox in Section 10 must be true before the CLI ships to npm and the VS Code extension publishes to the Marketplace._
