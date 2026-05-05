/* eslint-disable no-console -- CLI output intentionally uses console */
/* eslint-disable no-restricted-imports -- platform-cli is the composition root; adapter import is intentional */
/* eslint-disable no-restricted-syntax -- CLI reads process.env directly at bootstrap */
import { PLATFORM_VERSION, UpgradeOrchestrator } from '@platform/core';
import { parseReleaseManifest } from '@platform/core';

import type { DbConnections } from '../db-factory.js';

import { createRequire } from 'node:module';
import { PostgresAuditPort } from '@platform/adapter-audit-postgres';
import { Pool } from 'pg';

export interface UpgradeCommandOpts {
  dryRun: boolean;
  allowBreaking: boolean;
  skipBackupCheck: boolean;
  rollback: boolean;
  status: boolean;
  appliedBy?: string;
}

function buildAuditPort() {
  const pgUrl = process.env['POSTGRES_DIRECT_URL'] ?? process.env['POSTGRES_URL'];
  if (!pgUrl) {
    return null;
  }
  const pool = new Pool({ connectionString: pgUrl });
  return { audit: new PostgresAuditPort(pool), teardown: () => pool.end() };
}

function loadManifest() {
  const require = createRequire(import.meta.url);
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const raw = require('../../../../../release-manifest.json');
    return parseReleaseManifest(raw);
  } catch {
    return null;
  }
}

export async function runUpgradeCommand(
  connections: DbConnections,
  opts: UpgradeCommandOpts,
): Promise<void> {
  if (connections.targets.length === 0) {
    console.error('No databases configured. Set POSTGRES_URL, MSSQL_*, or MONGO_URI env vars.');
    process.exit(1);
  }

  // ── status sub-command ────────────────────────────────────────────────────

  if (opts.status) {
    console.log('Upgrade status per database:\n');
    for (const db of connections.targets) {
      const histRes = await db.versionPort.history();
      if (histRes.isErr()) {
        console.log(`  ${db.id}: error — ${histRes.error.message}`);
        continue;
      }
      const history = histRes.value;
      if (history.length === 0) {
        console.log(`  ${db.id}: no upgrades recorded (fresh install)`);
      } else {
        console.log(`  ${db.id}: ${String(history.length)} upgrade(s)`);
        for (const v of history.slice(0, 5)) {
          const by = v.appliedBy ? ` by ${v.appliedBy}` : '';
          console.log(`    ${v.releaseVersion}  ${v.appliedAt.toISOString()}${by}`);
        }
        if (history.length > 5) {
          console.log(`    ... and ${String(history.length - 5)} more`);
        }
      }
    }
    return;
  }

  // ── rollback sub-command ──────────────────────────────────────────────────

  if (opts.rollback) {
    const auditDep = buildAuditPort();

    const manifest = loadManifest();
    if (!manifest) {
      console.error('Cannot load release-manifest.json. Ensure it exists at repo root.');
      process.exit(1);
    }

    const orchestrator = new UpgradeOrchestrator({
      dbs: connections.targets,
      audit: auditDep?.audit ?? createNoOpAudit(),
      manifest,
      codeVersion: PLATFORM_VERSION,
    });

    console.log('Rolling back one step…');
    const result = await orchestrator.rollback(
      opts.appliedBy !== undefined ? { appliedBy: opts.appliedBy } : {},
    );

    await auditDep?.teardown();

    if (result.isErr()) {
      console.error(`Rollback failed: ${result.error.message}`);
      process.exit(1);
    }

    const r = result.value;
    console.log(`Rolled back version: ${r.rolledBackVersion} (${String(r.durationMs)}ms)`);
    for (const db of r.dbs) {
      const status = db.success ? '✓' : '✗';
      const warn = db.warning ? `  ⚠  ${db.warning}` : '';
      console.log(`  ${status} ${db.id} (${db.kind})${warn}`);
    }
    return;
  }

  // ── upgrade sub-command ───────────────────────────────────────────────────

  const manifest = loadManifest();
  if (!manifest) {
    console.error(
      'Cannot load release-manifest.json.\n' +
        'Ensure release-manifest.json exists at the repo root and is valid.',
    );
    process.exit(1);
  }

  const auditDep = buildAuditPort();

  const orchestrator = new UpgradeOrchestrator({
    dbs: connections.targets,
    audit: auditDep?.audit ?? createNoOpAudit(),
    manifest,
    codeVersion: PLATFORM_VERSION,
  });

  const label = opts.dryRun ? 'Dry run: ' : '';
  console.log(`${label}Upgrading to ${PLATFORM_VERSION}…`);

  const result = await orchestrator.upgrade({
    ...(opts.appliedBy !== undefined ? { appliedBy: opts.appliedBy } : {}),
    dryRun: opts.dryRun,
    allowBreaking: opts.allowBreaking,
    skipBackupCheck: opts.skipBackupCheck,
  });

  await auditDep?.teardown();

  if (result.isErr()) {
    const e = result.error;
    console.error(`Upgrade failed [${e.code}]: ${e.message}`);
    if (e.dbId) console.error(`  Database: ${e.dbId}`);
    process.exit(1);
  }

  const r = result.value;
  const from = r.fromVersion ?? '(fresh install)';
  console.log(`✓ ${from} → ${r.toVersion}  (${String(r.durationMs)}ms)`);
  for (const db of r.dbs) {
    console.log(`  ${db.id}: ${String(db.migrationsApplied)} migration(s) applied`);
  }

  if (opts.dryRun) {
    console.log('\nDry run complete. No changes were made.');
  }
}

// ── No-op audit for when no Postgres DB is configured ────────────────────────

function createNoOpAudit() {
  const noop = () =>
    Promise.resolve({
      isOk: () => true,
      isErr: () => false,
      _unsafeUnwrap: () => undefined,
      _unsafeUnwrapErr: () => undefined,
    });
  return {
    write: noop,
    writeBatch: () =>
      Promise.resolve({
        isOk: () => true,
        isErr: () => false,
        _unsafeUnwrap: () => [] as never[],
        _unsafeUnwrapErr: () => undefined,
      }),
    query: noop,
    exportStream: async function* () {
      /* no-op */
    },
    verifyChain: noop,
    startDataSubjectExport: noop,
    startErasureRequest: noop,
  } as never;
}
