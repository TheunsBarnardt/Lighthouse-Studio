/**
 * Platform migration runner for MongoDB.
 *
 * Implements SchemaMigrationPort for programmatic access.
 * Migrations are TypeScript files executed against the MongoDB driver.
 *
 * CLI:
 *   tsx src/migrate.ts apply           — apply pending migrations
 *   tsx src/migrate.ts status          — show applied / pending
 *   tsx src/migrate.ts create <name>   — scaffold a new migration file
 */

import type { Db } from 'mongodb';
import type { Result } from 'neverthrow';

import {
  PersistenceError,
  type MigrationRecord,
  type SchemaMigrationPort,
} from '@platform/ports-persistence';
import { MongoClient } from 'mongodb';
import { err, ok } from 'neverthrow';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as url from 'node:url';

const TRACKING_COLLECTION = '__platform_migrations';

type TrackingDoc = { _id: string; name: string; checksum: string; applied_at: Date };

const print = (msg: string): void => {
  process.stdout.write(msg + '\n');
};
const printErr = (msg: string): void => {
  process.stderr.write(msg + '\n');
};

export interface MongoMigration {
  up(db: Db): Promise<void>;
  down?(db: Db): Promise<void>;
}

export function checksumFile(source: string): string {
  return crypto.createHash('sha256').update(source, 'utf8').digest('hex');
}

// ── SchemaMigrationPort adapter ───────────────────────────────────────────────

export class MongoMigrationRunner implements SchemaMigrationPort {
  constructor(
    private readonly db: Db,
    private readonly migrationsDir?: string,
  ) {}

  async listApplied(): Promise<Result<MigrationRecord[], PersistenceError>> {
    try {
      const docs = await this.db
        .collection<TrackingDoc>(TRACKING_COLLECTION)
        .find({})
        .sort({ applied_at: 1 })
        .toArray();

      const records = docs.map((d) => ({
        id: d._id,
        name: d.name,
        appliedAt: d.applied_at,
        checksum: d.checksum,
      }));
      return ok(records);
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `Failed to list migrations: ${String(e)}`, e));
    }
  }

  async apply(migration: {
    id: string;
    name: string;
    up: string;
    down?: string;
  }): Promise<Result<void, PersistenceError>> {
    try {
      const checksum = checksumFile(migration.up);

      const col = this.db.collection<TrackingDoc>(TRACKING_COLLECTION);
      await col.updateOne(
        { _id: migration.id },
        {
          $setOnInsert: {
            _id: migration.id,
            name: migration.name,
            checksum,
            applied_at: new Date(),
          },
        },
        { upsert: true },
      );
      return ok(undefined);
    } catch (e) {
      return err(
        new PersistenceError('UNKNOWN', `Migration "${migration.name}" failed: ${String(e)}`, e),
      );
    }
  }

  async revert(migrationId: string): Promise<Result<void, PersistenceError>> {
    try {
      await this.db.collection<TrackingDoc>(TRACKING_COLLECTION).deleteOne({ _id: migrationId });
      return ok(undefined);
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `revert failed: ${String(e)}`, e));
    }
  }

  async isApplied(migrationId: string): Promise<Result<boolean, PersistenceError>> {
    try {
      const count = await this.db
        .collection<TrackingDoc>(TRACKING_COLLECTION)
        .countDocuments({ _id: migrationId });
      return ok(count > 0);
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `isApplied failed: ${String(e)}`, e));
    }
  }

  // ── File-based helpers (used by CLI) ──────────────────────────────────────

  async applyPending(): Promise<Result<MigrationRecord[], PersistenceError>> {
    const migrationsDir = this.migrationsDir;
    if (!migrationsDir) {
      return err(new PersistenceError('UNKNOWN', 'migrationsDir not configured'));
    }
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const files = (await fs.readdir(migrationsDir))
        .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
        .filter((f) => !f.endsWith('.down.ts') && !f.endsWith('.down.js'))
        .sort();

      const appliedRes = await this.listApplied();
      if (appliedRes.isErr()) return err(appliedRes.error);
      const appliedSet = new Set(appliedRes.value.map((r) => r.name));

      const applied: MigrationRecord[] = [];

      for (const file of files) {
        if (appliedSet.has(file)) continue;

        const filePath = path.join(migrationsDir, file);
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const source = await fs.readFile(filePath, 'utf8');
        const checksum = checksumFile(source);

        const module = (await import(url.pathToFileURL(filePath).href)) as {
          default: MongoMigration;
        };
        await module.default.up(this.db);

        const id = crypto.randomUUID();
        const now = new Date();
        const col = this.db.collection<TrackingDoc>(TRACKING_COLLECTION);
        await col.insertOne({ _id: id, name: file, checksum, applied_at: now });

        const record: MigrationRecord = { id, name: file, appliedAt: now, checksum };
        applied.push(record);
        print(`  Applied: ${file}`);
      }

      return ok(applied);
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `Migration failed: ${String(e)}`, e));
    }
  }

  async rollbackLast(): Promise<Result<void, PersistenceError>> {
    const migrationsDir = this.migrationsDir;
    if (!migrationsDir) {
      return err(new PersistenceError('UNKNOWN', 'migrationsDir not configured'));
    }
    try {
      const appliedRes = await this.listApplied();
      if (appliedRes.isErr()) return err(appliedRes.error);
      const applied = appliedRes.value;
      if (applied.length === 0) {
        return err(new PersistenceError('UNKNOWN', 'No migrations to roll back'));
      }

      const last = applied[applied.length - 1];
      if (!last) return err(new PersistenceError('UNKNOWN', 'No migrations to roll back'));

      const filePath = path.join(migrationsDir, last.name);
      const module = (await import(url.pathToFileURL(filePath).href)) as {
        default: MongoMigration;
      };
      if (!module.default.down) {
        return err(
          new PersistenceError('UNKNOWN', `Migration "${last.name}" has no down() function`),
        );
      }
      await module.default.down(this.db);
      const revertRes = await this.revert(last.id);
      if (revertRes.isErr()) return revertRes;
      print(`  Rolled back: ${last.name}`);
      return ok(undefined);
    } catch (e) {
      return err(new PersistenceError('UNKNOWN', `Rollback failed: ${String(e)}`, e));
    }
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv;

  // eslint-disable-next-line no-restricted-syntax
  const uri = process.env['MONGO_URI'] ?? 'mongodb://localhost:27017';
  // eslint-disable-next-line no-restricted-syntax
  const database = process.env['MONGO_DATABASE'] ?? 'platform';

  const client = new MongoClient(uri, { retryWrites: true, retryReads: true });

  const __filename = url.fileURLToPath(import.meta.url);
  const migrationsDir = path.join(path.dirname(__filename), '..', 'migrations');

  try {
    await client.connect();
    const db = client.db(database);
    const runner = new MongoMigrationRunner(db, migrationsDir);

    switch (command) {
      case 'apply': {
        print('Applying migrations…');
        const r = await runner.applyPending();
        if (r.isErr()) {
          printErr(r.error.message);
          process.exitCode = 1;
          break;
        }
        print(
          r.value.length === 0
            ? 'No pending migrations.'
            : `Applied ${String(r.value.length)} migration(s).`,
        );
        break;
      }
      case 'status': {
        const r = await runner.listApplied();
        if (r.isErr()) {
          printErr(r.error.message);
          process.exitCode = 1;
          break;
        }
        if (r.value.length === 0) {
          print('No migrations applied.');
          break;
        }
        r.value.forEach((m) => {
          print(`  [x] ${m.name}  (${m.appliedAt.toISOString()})`);
        });
        break;
      }
      case 'create': {
        const name = args[0];
        if (!name) {
          printErr('Usage: migrate.ts create <name>');
          process.exitCode = 1;
          break;
        }
        const ts = new Date()
          .toISOString()
          .replace(/[-T:.Z]/g, '')
          .slice(0, 14);
        const fileName = `${ts}_${name}.ts`;
        await fs.mkdir(migrationsDir, { recursive: true });
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await fs.writeFile(
          path.join(migrationsDir, fileName),
          [
            `import type { Db } from 'mongodb';`,
            `import type { MongoMigration } from '../src/migrate.js';`,
            ``,
            `const migration: MongoMigration = {`,
            `  async up(db: Db): Promise<void> {`,
            `    // TODO`,
            `  },`,
            `  async down(db: Db): Promise<void> {`,
            `    // TODO`,
            `  },`,
            `};`,
            ``,
            `export default migration;`,
          ].join('\n'),
        );
        print(`Created: ${fileName}`);
        break;
      }
      default:
        printErr(`Unknown command: ${command ?? '(none)'}. Use: apply | status | create`);
        process.exitCode = 1;
    }
  } finally {
    await client.close();
  }
}

if (import.meta.url === url.pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e: unknown) => {
    process.stderr.write(String(e) + '\n');
    process.exitCode = 1;
  });
}
