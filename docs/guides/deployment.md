# Deployment Guide (Stage 9)

Stage 9 takes your approved artifacts — UI from Stage 6, server functions from Stage 7, and tests from Stage 8 — and deploys them to your configured environments.

## What deployment does

1. **Generates a deployment plan** — environments, schema migration order, health check config, rollback strategy
2. **Deploys to dev** — optionally auto-deploys; runs schema migrations, server and UI bundles, health checks
3. **Promotes to staging** — runs tests, requires workspace admin approval
4. **Promotes to production** — runs tests, requires architect + workspace owner approval; rolling or blue/green deploy

## Prerequisites

- Stage 6 (UI Generation) approved
- Stage 7 (Code Generation) approved
- Stage 8 (Test Generation) approved and test suite created
- Workspace environments configured in Settings → Environments (from Objective 2)

## Deployment flow

### 1. Generate and review the deployment plan

Click **Generate Deployment Plan**. The AI generates:
- Per-environment configuration (approval gates, test requirements, deploy mode)
- Schema migration sequence (additive before destructive)
- Health check endpoints (derived from your routes and functions)
- Rollback feasibility assessment

Review the plan. Pay attention to **irreversible operations** — schema changes that cannot be automatically rolled back.

Edit the plan if needed. Common edits:
- Add Slack notification channel for production
- Switch production to blue/green deploy mode
- Adjust health check timeout for slow-starting apps

### 2. Approve the plan

Click **Approve Plan**. This records approval in the audit log and unlocks the deploy buttons.

### 3. Deploy to dev

Click **Deploy to Dev**. The deployment monitor shows real-time progress:
1. Pre-flight check — environment ready?
2. Schema migrations — applied in sequence
3. Server functions — bundle deployed
4. UI — bundle deployed, cache invalidated
5. Health check — endpoints verified

### 4. Promote to staging

After dev deployment succeeds, click **Promote to Staging**. This requires workspace admin approval. Tests run before deployment proceeds.

### 5. Promote to production

After staging, click **Promote to Production**. Requires architect + workspace owner approval (both must approve, configurable). Production uses rolling deploy by default; blue/green if configured.

## Rollback

Click **Rollback** in the deployment monitor or environment status panel. Rollback:
- Reverts UI bundle and server functions to the prior version
- Reverts schema migrations (if reversible)
- Runs health check after rollback

If schema migrations are irreversible, the platform alerts: "Code rolled back, schema cannot be reverted. Review compatibility."

Rollback window: 7 days from deployment (configurable up to 30 days).

## Deploy modes

| Mode | How it works | Resource cost | Zero-downtime |
|------|-------------|---------------|---------------|
| Rolling (default) | Updates instances one at a time | Normal | Near-zero (brief mixed-version window) |
| Blue/Green | Parallel environment; atomic traffic switch | 2× during deploy | Yes |

Configure per environment in the deployment plan.

## Health checks

Post-deploy health checks hit:
- `/api/health` — standard health endpoint
- `/` — UI root
- One server function synthetic invocation

Failure policy: auto-rollback in dev/staging; alert + human decision in production.

## Cost

| Phase | Model | Est. cost |
|-------|-------|-----------|
| Plan generation | claude-haiku-4-5 | $0.20 |
| Migration sequencing | claude-haiku-4-5 | $0.05 |
| Health check config | claude-haiku-4-5 | $0.05 |
| **Total AI cost** | | **~$0.30** |

Runtime infrastructure costs (compute, database, CDN) depend on your environment configuration.

## Troubleshooting

See runbooks:
- [Deployment stuck](../runbooks/deployment-stuck.md)
- [Rollback failed](../runbooks/deployment-rollback-failed.md)
- [Irreversible schema rollback](../runbooks/deployment-schema-irreversible.md)
- [Health check flapping](../runbooks/deployment-health-check-flapping.md)
- [Tests failing during deployment](../runbooks/deployment-tests-failing.md)
