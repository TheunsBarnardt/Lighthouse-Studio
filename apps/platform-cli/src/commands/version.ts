/* eslint-disable no-console -- CLI output intentionally uses console */
import { PLATFORM_VERSION } from '@platform/core';

import type { DbConnections } from '../db-factory.js';

export async function runVersionCommand(connections: DbConnections): Promise<void> {
  console.log(`Platform version (code): ${PLATFORM_VERSION}`);
  console.log('');

  if (connections.targets.length === 0) {
    console.log('No databases configured. Set POSTGRES_URL, MSSQL_*, or MONGO_URI env vars.');
    return;
  }

  for (const db of connections.targets) {
    const result = await db.versionPort.current();
    if (result.isErr()) {
      console.log(`  ${db.id} (${db.kind}): error reading version — ${result.error.message}`);
      continue;
    }
    const v = result.value;
    if (!v) {
      console.log(`  ${db.id} (${db.kind}): fresh install (no version recorded)`);
    } else {
      const appliedAt = v.appliedAt.toISOString();
      const by = v.appliedBy ? ` by ${v.appliedBy}` : '';
      console.log(`  ${db.id} (${db.kind}): ${v.releaseVersion} — applied ${appliedAt}${by}`);
      if (v.schemaMigrationHighWater) {
        console.log(`    schema high-water: ${v.schemaMigrationHighWater}`);
      }
    }
  }
}
