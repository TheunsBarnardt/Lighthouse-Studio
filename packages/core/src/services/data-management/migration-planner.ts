import { uuidv7 } from 'uuidv7';

import type {
  BlockingChange,
  ColumnDefinition,
  CustomerSchema,
  CustomerTableDefinition,
  DatabaseDriver,
  DestructiveChange,
  ForeignKeyDefinition,
  IndexDefinition,
  MigrationPlan,
  MigrationStep,
  NormalizedType,
  SchemaChanges,
} from './schema-model.js';

// ── MigrationPlanner ───────────────────────────────────────────────────────────
// Diffs a current schema against proposed changes and produces a MigrationPlan:
// an ordered list of MigrationSteps with DDL (or Mongo commands), estimated
// durations, and flags for destructive/blocking operations.
//
// The planner is database-agnostic at this layer; it delegates DDL generation
// to driver-specific helpers so the service stays clean.

export class MigrationPlanner {
  plan(current: CustomerSchema, proposed: SchemaChanges, driver: DatabaseDriver): MigrationPlan {
    const steps: MigrationStep[] = [];
    const destructiveChanges: DestructiveChange[] = [];
    const blockingChanges: BlockingChange[] = [];

    const currentTables = current.tables;
    const proposedTables = proposed.tables ?? current.tables;

    const currentById = new Map(currentTables.map((t) => [t.id, t]));
    const proposedById = new Map(proposedTables.map((t) => [t.id, t]));

    // ── Dropped tables ─────────────────────────────────────────────────────────
    for (const [id, tbl] of currentById) {
      if (!proposedById.has(id)) {
        steps.push(dropTableStep(tbl, driver));
        destructiveChanges.push({
          description: `Table '${tbl.name}' will be dropped with all its data.`,
          dataLoss: true,
        });
        blockingChanges.push({
          description: `DROP TABLE ${tbl.name} acquires an exclusive lock.`,
          estimatedBlockMs: 100,
        });
      }
    }

    // ── New tables ─────────────────────────────────────────────────────────────
    for (const [id, tbl] of proposedById) {
      if (!currentById.has(id)) {
        steps.push(createTableStep(tbl, driver));
      }
    }

    // ── Modified tables ────────────────────────────────────────────────────────
    for (const [id, proposed] of proposedById) {
      const current = currentById.get(id);
      if (!current) continue; // new table handled above

      const tableSteps = this.diffTable(
        current,
        proposed,
        driver,
        destructiveChanges,
        blockingChanges,
      );
      steps.push(...tableSteps);
    }

    const estimatedTotalDurationMs = steps.reduce((sum, s) => sum + s.estimatedDurationMs, 0);

    return {
      steps,
      estimatedTotalDurationMs,
      destructiveChanges,
      blockingChanges,
      dataLossRisk: destructiveChanges.some((d) => d.dataLoss),
    };
  }

  // ── Table diffing ────────────────────────────────────────────────────────────

  private diffTable(
    current: CustomerTableDefinition,
    proposed: CustomerTableDefinition,
    driver: DatabaseDriver,
    destructiveChanges: DestructiveChange[],
    blockingChanges: BlockingChange[],
  ): MigrationStep[] {
    const steps: MigrationStep[] = [];

    // Rename
    if (current.name !== proposed.name) {
      steps.push(renameTableStep(current.name, proposed.name, driver));
    }

    const currentColsById = new Map(current.columns.map((c) => [c.id, c]));
    const proposedColsById = new Map(proposed.columns.map((c) => [c.id, c]));

    // Dropped columns
    for (const [id, col] of currentColsById) {
      if (!proposedColsById.has(id)) {
        steps.push(dropColumnStep(proposed.name, col.name, driver));
        destructiveChanges.push({
          description: `Column '${proposed.name}.${col.name}' will be dropped. Any data in this column will be lost.`,
          dataLoss: true,
        });
        blockingChanges.push({
          description: `ALTER TABLE DROP COLUMN on '${proposed.name}' takes a brief lock.`,
          estimatedBlockMs: 50,
        });
      }
    }

    // New columns
    for (const [id, col] of proposedColsById) {
      if (!currentColsById.has(id)) {
        const hasDefault = col.defaultValue !== undefined || col.nullable;
        const blockMs = hasDefault ? 0 : 500; // non-nullable without default rewrites all rows
        steps.push(addColumnStep(proposed.name, col, driver));
        if (!hasDefault) {
          blockingChanges.push({
            description: `Adding NOT NULL column '${col.name}' without a default may rewrite table '${proposed.name}' (${driver === 'postgres' ? 'Postgres rewrites the heap' : 'table scan required'}).`,
            estimatedBlockMs: blockMs,
          });
        }
      }
    }

    // Renamed / type-changed columns
    for (const [id, proposed] of proposedColsById) {
      const curr = currentColsById.get(id);
      if (!curr) continue;

      if (curr.name !== proposed.name) {
        steps.push(renameColumnStep(current.name, curr.name, proposed.name, driver));
      }

      if (!typesEqual(curr.type, proposed.type)) {
        const destructive = isTypeChangeDestructive(curr.type, proposed.type);
        steps.push(
          changeColumnTypeStep(current.name, proposed.name, proposed.type, driver, destructive),
        );
        if (destructive) {
          destructiveChanges.push({
            description: `Column '${current.name}.${proposed.name}' type change from ${typeLabel(curr.type)} to ${typeLabel(proposed.type)} may lose precision or data.`,
            dataLoss: true,
          });
        }
        blockingChanges.push({
          description: `ALTER COLUMN type on '${current.name}.${proposed.name}' acquires a lock.`,
          estimatedBlockMs: 200,
        });
      }
    }

    // Index diffing
    const currentIdxById = new Map(current.indexes.map((i) => [i.id, i]));
    const proposedIdxById = new Map(proposed.indexes.map((i) => [i.id, i]));

    for (const [id, idx] of currentIdxById) {
      if (!proposedIdxById.has(id)) {
        steps.push(dropIndexStep(proposed.name, idx.name, driver));
      }
    }

    for (const [id, idx] of proposedIdxById) {
      if (!currentIdxById.has(id)) {
        steps.push(createIndexStep(proposed.name, idx, driver, blockingChanges));
      }
    }

    // FK diffing
    const currentFkById = new Map(current.foreignKeys.map((f) => [f.id, f]));
    const proposedFkById = new Map(proposed.foreignKeys.map((f) => [f.id, f]));

    for (const [id] of currentFkById) {
      if (!proposedFkById.has(id)) {
        const fk = currentFkById.get(id);
        if (!fk) continue;
        steps.push(dropFkStep(proposed.name, fk.name, driver));
      }
    }

    for (const [id, fk] of proposedFkById) {
      if (!currentFkById.has(id)) {
        steps.push(addFkStep(proposed.name, fk, driver));
      }
    }

    return steps;
  }
}

// ── DDL generator helpers ──────────────────────────────────────────────────────
// Each function returns a MigrationStep. DDL strings are dialect-specific but
// kept simple — the migration executor handles parameterization.

function createTableStep(table: CustomerTableDefinition, driver: DatabaseDriver): MigrationStep {
  const ddl =
    driver === 'mongo'
      ? `db.createCollection("${table.name}")` // Mongo: explicit creation
      : `CREATE TABLE "${table.name}" (/* columns generated by executor */)`;

  return {
    id: uuidv7(),
    description: `Create table '${table.name}'`,
    ddl,
    reverseDdl:
      driver === 'mongo' ? `db.${table.name}.drop()` : `DROP TABLE IF EXISTS "${table.name}"`,
    estimatedDurationMs: 200,
    reversible: true,
  };
}

function dropTableStep(table: CustomerTableDefinition, driver: DatabaseDriver): MigrationStep {
  return {
    id: uuidv7(),
    description: `Drop table '${table.name}' (DESTRUCTIVE — data will be lost)`,
    ddl: driver === 'mongo' ? `db.${table.name}.drop()` : `DROP TABLE IF EXISTS "${table.name}"`,
    estimatedDurationMs: 100,
    reversible: false,
  };
}

function renameTableStep(from: string, to: string, driver: DatabaseDriver): MigrationStep {
  const ddl =
    driver === 'mssql'
      ? `EXEC sp_rename '${from}', '${to}'`
      : driver === 'mongo'
        ? `db.${from}.renameCollection("${to}")`
        : `ALTER TABLE "${from}" RENAME TO "${to}"`;

  return {
    id: uuidv7(),
    description: `Rename table '${from}' → '${to}'`,
    ddl,
    reverseDdl:
      driver === 'mssql'
        ? `EXEC sp_rename '${to}', '${from}'`
        : driver === 'mongo'
          ? `db.${to}.renameCollection("${from}")`
          : `ALTER TABLE "${to}" RENAME TO "${from}"`,
    estimatedDurationMs: 50,
    reversible: true,
  };
}

function addColumnStep(
  tableName: string,
  col: ColumnDefinition,
  _driver: DatabaseDriver,
): MigrationStep {
  return {
    id: uuidv7(),
    description: `Add column '${tableName}.${col.name}'`,
    ddl: `ALTER TABLE "${tableName}" ADD COLUMN "${col.name}" /* type generated by executor */`,
    reverseDdl: `ALTER TABLE "${tableName}" DROP COLUMN "${col.name}"`,
    estimatedDurationMs: col.nullable ? 50 : 500,
    reversible: true,
  };
}

function dropColumnStep(
  tableName: string,
  colName: string,
  _driver: DatabaseDriver,
): MigrationStep {
  return {
    id: uuidv7(),
    description: `Drop column '${tableName}.${colName}' (DESTRUCTIVE — data will be lost)`,
    ddl: `ALTER TABLE "${tableName}" DROP COLUMN "${colName}"`,
    estimatedDurationMs: 100,
    reversible: false,
  };
}

function renameColumnStep(
  tableName: string,
  from: string,
  to: string,
  driver: DatabaseDriver,
): MigrationStep {
  const ddl =
    driver === 'mssql'
      ? `EXEC sp_rename '${tableName}.${from}', '${to}', 'COLUMN'`
      : driver === 'mongo'
        ? `db.${tableName}.updateMany({}, { $rename: { "${from}": "${to}" } })`
        : `ALTER TABLE "${tableName}" RENAME COLUMN "${from}" TO "${to}"`;

  return {
    id: uuidv7(),
    description: `Rename column '${tableName}.${from}' → '${to}'`,
    ddl,
    reverseDdl:
      driver === 'mssql'
        ? `EXEC sp_rename '${tableName}.${to}', '${from}', 'COLUMN'`
        : driver === 'mongo'
          ? `db.${tableName}.updateMany({}, { $rename: { "${to}": "${from}" } })`
          : `ALTER TABLE "${tableName}" RENAME COLUMN "${to}" TO "${from}"`,
    estimatedDurationMs: 50,
    reversible: true,
  };
}

function changeColumnTypeStep(
  tableName: string,
  colName: string,
  type: NormalizedType,
  _driver: DatabaseDriver,
  destructive: boolean,
): MigrationStep {
  return {
    id: uuidv7(),
    description: `Change type of '${tableName}.${colName}' to ${typeLabel(type)}${destructive ? ' (may lose data)' : ''}`,
    ddl: `ALTER TABLE "${tableName}" ALTER COLUMN "${colName}" TYPE /* ${typeLabel(type)} */`,
    estimatedDurationMs: destructive ? 5000 : 200,
    reversible: !destructive,
  };
}

function createIndexStep(
  tableName: string,
  idx: IndexDefinition,
  driver: DatabaseDriver,
  blockingChanges: BlockingChange[],
): MigrationStep {
  const concurrent = driver === 'postgres';
  const ddl = concurrent
    ? `CREATE ${idx.unique ? 'UNIQUE ' : ''}INDEX CONCURRENTLY "${idx.name}" ON "${tableName}" (/* columns */)`
    : `CREATE ${idx.unique ? 'UNIQUE ' : ''}INDEX "${idx.name}" ON "${tableName}" (/* columns */)`;

  if (!concurrent) {
    blockingChanges.push({
      description: `Creating index '${idx.name}' on '${tableName}' will briefly lock writes.`,
      estimatedBlockMs: 1000,
    });
  }

  return {
    id: uuidv7(),
    description: `Create index '${idx.name}' on '${tableName}'`,
    ddl,
    reverseDdl: `DROP INDEX IF EXISTS "${idx.name}"`,
    estimatedDurationMs: 2000,
    reversible: true,
  };
}

function dropIndexStep(tableName: string, idxName: string, driver: DatabaseDriver): MigrationStep {
  return {
    id: uuidv7(),
    description: `Drop index '${idxName}' on '${tableName}'`,
    ddl:
      driver === 'mssql'
        ? `DROP INDEX "${tableName}"."${idxName}"`
        : `DROP INDEX IF EXISTS "${idxName}"`,
    estimatedDurationMs: 100,
    reversible: false,
  };
}

function addFkStep(
  tableName: string,
  fk: ForeignKeyDefinition,
  driver: DatabaseDriver,
): MigrationStep {
  const advisory = driver === 'mongo';
  const reverseDdl = advisory
    ? undefined
    : `ALTER TABLE "${tableName}" DROP CONSTRAINT "${fk.name}"`;
  return {
    id: uuidv7(),
    description: advisory
      ? `Record advisory FK '${fk.name}' on '${tableName}' (Mongo: metadata only, not DB-enforced)`
      : `Add foreign key '${fk.name}' on '${tableName}'`,
    ddl: advisory
      ? `/* advisory FK stored in platform metadata only */`
      : `ALTER TABLE "${tableName}" ADD CONSTRAINT "${fk.name}" FOREIGN KEY (/* columns */) REFERENCES /* table */ (/* columns */)`,
    ...(reverseDdl !== undefined ? { reverseDdl } : {}),
    estimatedDurationMs: advisory ? 1 : 500,
    reversible: true,
  };
}

function dropFkStep(tableName: string, fkName: string, driver: DatabaseDriver): MigrationStep {
  return {
    id: uuidv7(),
    description: `Drop foreign key '${fkName}' on '${tableName}'`,
    ddl:
      driver === 'mssql'
        ? `ALTER TABLE "${tableName}" DROP CONSTRAINT "${fkName}"`
        : driver === 'mongo'
          ? `/* advisory FK removed from platform metadata */`
          : `ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${fkName}"`,
    estimatedDurationMs: 100,
    reversible: false,
  };
}

// ── Type helpers ───────────────────────────────────────────────────────────────

function typesEqual(a: NormalizedType, b: NormalizedType): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isTypeChangeDestructive(from: NormalizedType, to: NormalizedType): boolean {
  // Widening is safe; narrowing may lose data.
  const safeWidenings: Record<string, string[]> = {
    integer: ['bigint', 'decimal', 'text', 'string'],
    string: ['text'],
    date: ['timestamp', 'timestamp_tz'],
    timestamp: ['timestamp_tz'],
  };
  const fromKind = from.kind;
  const toKind = to.kind;
  return !(safeWidenings[fromKind]?.includes(toKind) ?? false);
}

function typeLabel(type: NormalizedType): string {
  switch (type.kind) {
    case 'string':
      return type.length ? `string(${String(type.length)})` : 'string';
    case 'decimal':
      return `decimal(${String(type.precision)},${String(type.scale)})`;
    case 'array':
      return `${typeLabel(type.elementType)}[]`;
    default:
      return type.kind;
  }
}
