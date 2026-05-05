import type {
  PlatformVersion,
  PlatformVersionPort,
  RecordVersionInput,
} from '@platform/ports-platform-version';
import type { Db, WithId } from 'mongodb';

import { PlatformVersionError } from '@platform/ports-platform-version';
import { err, ok, type Result } from 'neverthrow';

interface PlatformVersionDoc {
  release_version: string;
  applied_at: Date;
  applied_by?: string;
  schema_migration_high_water?: string;
  notes?: string;
}

function docToVersion(doc: WithId<PlatformVersionDoc>): PlatformVersion {
  return {
    releaseVersion: doc.release_version,
    appliedAt: doc.applied_at,
    ...(doc.applied_by != null ? { appliedBy: doc.applied_by } : {}),
    ...(doc.schema_migration_high_water != null
      ? { schemaMigrationHighWater: doc.schema_migration_high_water }
      : {}),
    ...(doc.notes != null ? { notes: doc.notes } : {}),
  };
}

export class MongoPlatformVersionAdapter implements PlatformVersionPort {
  constructor(private readonly db: Db) {}

  private col() {
    return this.db.collection<PlatformVersionDoc>('platform_versions');
  }

  async current(): Promise<Result<PlatformVersion | null, PlatformVersionError>> {
    try {
      const doc = await this.col().findOne({}, { sort: { applied_at: -1 } });
      if (!doc) return ok(null);
      return ok(docToVersion(doc));
    } catch (cause) {
      return err(new PlatformVersionError('QUERY_FAILED', 'Failed to query current version', cause));
    }
  }

  async history(): Promise<Result<PlatformVersion[], PlatformVersionError>> {
    try {
      const docs = await this.col().find({}).sort({ applied_at: -1 }).toArray();
      return ok(docs.map(docToVersion));
    } catch (cause) {
      return err(new PlatformVersionError('QUERY_FAILED', 'Failed to query version history', cause));
    }
  }

  async record(input: RecordVersionInput): Promise<Result<void, PlatformVersionError>> {
    try {
      const doc: PlatformVersionDoc = {
        release_version: input.releaseVersion,
        applied_at: new Date(),
        ...(input.appliedBy != null ? { applied_by: input.appliedBy } : {}),
        ...(input.schemaMigrationHighWater != null
          ? { schema_migration_high_water: input.schemaMigrationHighWater }
          : {}),
        ...(input.notes != null ? { notes: input.notes } : {}),
      };
      await this.col().insertOne(doc);
      return ok(undefined);
    } catch (cause) {
      return err(new PlatformVersionError('RECORD_FAILED', 'Failed to record version', cause));
    }
  }

  async rollback(): Promise<Result<PlatformVersion, PlatformVersionError>> {
    try {
      const latest = await this.col().findOne({}, { sort: { applied_at: -1 } });
      if (!latest) {
        return err(
          new PlatformVersionError('NOTHING_TO_ROLLBACK', 'No version documents to roll back'),
        );
      }

      await this.col().deleteOne({ _id: latest._id });
      return ok(docToVersion(latest));
    } catch (cause) {
      return err(new PlatformVersionError('ROLLBACK_FAILED', 'Failed to roll back version', cause));
    }
  }
}
