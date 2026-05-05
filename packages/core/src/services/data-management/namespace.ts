import type { DatabaseDriver } from './schema-model.js';

// ── Customer namespace conventions ─────────────────────────────────────────────
//
// Per ADR-0094: platform tables and customer tables must live in separate
// namespaces at all times. These helpers derive the namespace names from a
// workspace slug, ensuring no collision with platform internals.
//
// Postgres/MSSQL: separate SQL schema  → cust_<workspace_slug>
// Mongo:          collection prefix    → cust_<workspace_slug>__
//
// Database role names (Postgres/MSSQL):
//   cust_<workspace_slug>_app      — runtime read/write on workspace tables
//   cust_<workspace_slug>_migrate  — DDL rights for migration executor

// Reserved prefixes that may never be used for workspace slugs.
export const RESERVED_SLUG_PREFIXES: ReadonlyArray<string> = [
  '_platform_',
  'platform_',
  'pg_',
  'information_schema',
  'sys',
  'dbo',
];

/** Maximum length for a workspace slug used in DB identifiers. */
const MAX_SLUG_LENGTH = 60;

/**
 * Derive the DB namespace (schema name on PG/MSSQL; prefix on Mongo) for
 * customer tables belonging to a workspace.
 */
export function customerNamespace(workspaceSlug: string, driver: DatabaseDriver): string {
  const safe = sanitizeSlug(workspaceSlug);
  if (driver === 'mongo') {
    return `cust_${safe}__`;
  }
  return `cust_${safe}`;
}

/**
 * Derive the Mongo collection name for a customer table.
 * Format: cust_<workspace_slug>__<table_name>
 */
export function customerCollectionName(workspaceSlug: string, tableName: string): string {
  return `${customerNamespace(workspaceSlug, 'mongo')}${tableName}`;
}

/**
 * Derive the runtime database role name for a workspace (Postgres/MSSQL).
 * This role has SELECT/INSERT/UPDATE/DELETE on the workspace's customer tables.
 */
export function customerAppRole(workspaceSlug: string): string {
  return `cust_${sanitizeSlug(workspaceSlug)}_app`;
}

/**
 * Derive the migration database role name for a workspace (Postgres/MSSQL).
 * This role has DDL rights (CREATE/ALTER/DROP TABLE) on the workspace's schema.
 */
export function customerMigrateRole(workspaceSlug: string): string {
  return `cust_${sanitizeSlug(workspaceSlug)}_migrate`;
}

/**
 * Derive the read-only query console role for a workspace (Postgres/MSSQL).
 * This role has SELECT-only rights — used for console read queries.
 */
export function customerReadonlyRole(workspaceSlug: string): string {
  return `cust_${sanitizeSlug(workspaceSlug)}_readonly`;
}

/**
 * Derive the console writer role for a workspace (Postgres/MSSQL).
 * This role has SELECT + INSERT/UPDATE/DELETE rights — used for console write queries.
 */
export function customerConsoleWriterRole(workspaceSlug: string): string {
  return `cust_${sanitizeSlug(workspaceSlug)}_console_writer`;
}

/**
 * Generate the DDL to create the per-workspace Postgres schema and its roles.
 * Idempotent (IF NOT EXISTS / DO $$ IF NOT EXISTS).
 */
export function createWorkspacePostgresSchema(workspaceSlug: string): string {
  const schema = customerNamespace(workspaceSlug, 'postgres');
  const appRole = customerAppRole(workspaceSlug);
  const migrateRole = customerMigrateRole(workspaceSlug);

  return `
DO $$ BEGIN
  -- Schema
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = '${schema}') THEN
    EXECUTE 'CREATE SCHEMA "${schema}"';
  END IF;

  -- Runtime role
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${appRole}') THEN
    EXECUTE 'CREATE ROLE "${appRole}" NOLOGIN';
    EXECUTE 'GRANT USAGE ON SCHEMA "${schema}" TO "${appRole}"';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA "${schema}" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${appRole}"';
  END IF;

  -- Migration role
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${migrateRole}') THEN
    EXECUTE 'CREATE ROLE "${migrateRole}" NOLOGIN';
    EXECUTE 'GRANT ALL ON SCHEMA "${schema}" TO "${migrateRole}"';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA "${schema}" GRANT ALL ON TABLES TO "${migrateRole}"';
  END IF;
END $$;
`.trim();
}

/**
 * Generate the DDL to create the per-workspace MSSQL schema and its roles.
 * Idempotent.
 */
export function createWorkspaceMssqlSchema(workspaceSlug: string): string {
  const schema = customerNamespace(workspaceSlug, 'mssql');
  const appRole = customerAppRole(workspaceSlug);
  const migrateRole = customerMigrateRole(workspaceSlug);

  return `
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = '${schema}')
    EXEC('CREATE SCHEMA [${schema}]');
GO

IF DATABASE_PRINCIPAL_ID('${appRole}') IS NULL
    EXEC('CREATE ROLE [${appRole}]');
GO

GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[${schema}] TO [${appRole}];
GO

IF DATABASE_PRINCIPAL_ID('${migrateRole}') IS NULL
    EXEC('CREATE ROLE [${migrateRole}]');
GO

GRANT CONTROL ON SCHEMA::[${schema}] TO [${migrateRole}];
GO
`.trim();
}

/**
 * Generate the DDL to drop the per-workspace Postgres schema and its roles.
 * Used when a workspace is deleted.
 */
export function dropWorkspacePostgresSchema(workspaceSlug: string): string {
  const schema = customerNamespace(workspaceSlug, 'postgres');
  const appRole = customerAppRole(workspaceSlug);
  const migrateRole = customerMigrateRole(workspaceSlug);

  return `
DROP SCHEMA IF EXISTS "${schema}" CASCADE;
DROP ROLE IF EXISTS "${appRole}";
DROP ROLE IF EXISTS "${migrateRole}";
`.trim();
}

// ── Validation helpers ─────────────────────────────────────────────────────────

/** Truncate and sanitize a workspace slug for safe use in DB identifiers. */
function sanitizeSlug(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .slice(0, MAX_SLUG_LENGTH);
}

/**
 * Returns true if the workspace slug would conflict with a reserved prefix.
 * Called during workspace slug validation.
 */
export function isReservedSlug(slug: string): boolean {
  const lower = slug.toLowerCase();
  return RESERVED_SLUG_PREFIXES.some((p) => lower.startsWith(p));
}
