import type {
  PlatformVersion,
  PlatformVersionPort,
  RecordVersionInput,
} from '@platform/ports-platform-version';
import type { ConnectionPool } from 'mssql';

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

export class MssqlPlatformVersionAdapter implements PlatformVersionPort {
  constructor(private readonly pool: ConnectionPool) {}

  async current(): Promise<Result<PlatformVersion | null, PlatformVersionError>> {
    try {
      const res = await this.pool.request().query<PlatformVersionRow>(`
        SELECT TOP 1
          CAST(id AS NVARCHAR(36)) AS id,
          release_version,
          applied_at,
          applied_by,
          schema_migration_high_water,
          notes
        FROM [dbo].[platform_versions]
        ORDER BY applied_at DESC
      `);
      const row = res.recordset[0];
      if (!row) return ok(null);
      return ok(rowToVersion(row));
    } catch (cause) {
      return err(new PlatformVersionError('QUERY_FAILED', 'Failed to query current version', cause));
    }
  }

  async history(): Promise<Result<PlatformVersion[], PlatformVersionError>> {
    try {
      const res = await this.pool.request().query<PlatformVersionRow>(`
        SELECT
          CAST(id AS NVARCHAR(36)) AS id,
          release_version,
          applied_at,
          applied_by,
          schema_migration_high_water,
          notes
        FROM [dbo].[platform_versions]
        ORDER BY applied_at DESC
      `);
      return ok(res.recordset.map(rowToVersion));
    } catch (cause) {
      return err(new PlatformVersionError('QUERY_FAILED', 'Failed to query version history', cause));
    }
  }

  async record(input: RecordVersionInput): Promise<Result<void, PlatformVersionError>> {
    try {
      const req = this.pool.request();
      req.input('release_version', input.releaseVersion);
      req.input('applied_by', input.appliedBy ?? null);
      req.input('schema_migration_high_water', input.schemaMigrationHighWater ?? null);
      req.input('notes', input.notes ?? null);
      await req.query(`
        INSERT INTO [dbo].[platform_versions]
          (release_version, applied_by, schema_migration_high_water, notes)
        VALUES
          (@release_version, @applied_by, @schema_migration_high_water, @notes)
      `);
      return ok(undefined);
    } catch (cause) {
      return err(new PlatformVersionError('RECORD_FAILED', 'Failed to record version', cause));
    }
  }

  async rollback(): Promise<Result<PlatformVersion, PlatformVersionError>> {
    try {
      // MSSQL: no down-migrations yet (tracked as Obj 4a tightening).
      // Best-effort: delete the latest row; schema is not reverted.
      const latest = await this.pool.request().query<PlatformVersionRow>(`
        SELECT TOP 1
          CAST(id AS NVARCHAR(36)) AS id,
          release_version,
          applied_at,
          applied_by,
          schema_migration_high_water,
          notes
        FROM [dbo].[platform_versions]
        ORDER BY applied_at DESC
      `);
      const row = latest.recordset[0];
      if (!row) {
        return err(
          new PlatformVersionError('NOTHING_TO_ROLLBACK', 'No version rows to roll back'),
        );
      }

      const del = this.pool.request();
      del.input('id', row.id);
      await del.query(`DELETE FROM [dbo].[platform_versions] WHERE CAST(id AS NVARCHAR(36)) = @id`);

      return ok(rowToVersion(row));
    } catch (cause) {
      return err(new PlatformVersionError('ROLLBACK_FAILED', 'Failed to roll back version', cause));
    }
  }
}
