import type {
  PlatformVersion,
  PlatformVersionPort,
  RecordVersionInput,
} from '@platform/ports-platform-version';
import type { Pool } from 'pg';

import { PlatformVersionError } from '@platform/ports-platform-version';
import { err, ok, type Result } from 'neverthrow';

interface PlatformVersionRow {
  id: string;
  release_version: string;
  applied_at: Date;
  applied_by: string | null;
  schema_migration_high_water: string | null;
  notes: string | null;
}

function rowToVersion(row: PlatformVersionRow): PlatformVersion {
  return {
    releaseVersion: row.release_version,
    appliedAt: row.applied_at,
    ...(row.applied_by != null ? { appliedBy: row.applied_by } : {}),
    ...(row.schema_migration_high_water != null
      ? { schemaMigrationHighWater: row.schema_migration_high_water }
      : {}),
    ...(row.notes != null ? { notes: row.notes } : {}),
  };
}

export class PostgresPlatformVersionAdapter implements PlatformVersionPort {
  constructor(private readonly pool: Pool) {}

  async current(): Promise<Result<PlatformVersion | null, PlatformVersionError>> {
    try {
      const res = await this.pool.query<PlatformVersionRow>(
        `SELECT id, release_version, applied_at, applied_by, schema_migration_high_water, notes
         FROM platform_versions
         ORDER BY applied_at DESC
         LIMIT 1`,
      );
      if (res.rowCount === 0 || !res.rows[0]) return ok(null);
      return ok(rowToVersion(res.rows[0]));
    } catch (cause) {
      return err(new PlatformVersionError('QUERY_FAILED', 'Failed to query current version', cause));
    }
  }

  async history(): Promise<Result<PlatformVersion[], PlatformVersionError>> {
    try {
      const res = await this.pool.query<PlatformVersionRow>(
        `SELECT id, release_version, applied_at, applied_by, schema_migration_high_water, notes
         FROM platform_versions
         ORDER BY applied_at DESC`,
      );
      return ok(res.rows.map(rowToVersion));
    } catch (cause) {
      return err(new PlatformVersionError('QUERY_FAILED', 'Failed to query version history', cause));
    }
  }

  async record(input: RecordVersionInput): Promise<Result<void, PlatformVersionError>> {
    try {
      await this.pool.query(
        `INSERT INTO platform_versions (release_version, applied_by, schema_migration_high_water, notes)
         VALUES ($1, $2, $3, $4)`,
        [
          input.releaseVersion,
          input.appliedBy ?? null,
          input.schemaMigrationHighWater ?? null,
          input.notes ?? null,
        ],
      );
      return ok(undefined);
    } catch (cause) {
      return err(new PlatformVersionError('RECORD_FAILED', 'Failed to record version', cause));
    }
  }

  async rollback(): Promise<Result<PlatformVersion, PlatformVersionError>> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const latest = await client.query<PlatformVersionRow>(
        `SELECT id, release_version, applied_at, applied_by, schema_migration_high_water, notes
         FROM platform_versions
         ORDER BY applied_at DESC
         LIMIT 1
         FOR UPDATE`,
      );

      if (latest.rowCount === 0 || !latest.rows[0]) {
        await client.query('ROLLBACK');
        return err(
          new PlatformVersionError('NOTHING_TO_ROLLBACK', 'No version rows to roll back'),
        );
      }

      const row = latest.rows[0];
      await client.query('DELETE FROM platform_versions WHERE id = $1', [row.id]);
      await client.query('COMMIT');

      return ok(rowToVersion(row));
    } catch (cause) {
      await client.query('ROLLBACK').catch(() => undefined);
      return err(new PlatformVersionError('ROLLBACK_FAILED', 'Failed to roll back version', cause));
    } finally {
      client.release();
    }
  }
}
