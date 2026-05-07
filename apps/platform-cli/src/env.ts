/**
 * Read and validate the environment variables needed by the CLI.
 * The CLI requires at least one database URL; MSSQL and Mongo are optional.
 *
 * Migration URLs (POSTGRES_MIGRATE_URL, MSSQL_MIGRATE_USER/PASSWORD, MONGO_MIGRATE_URI):
 *   The database user used for migrations must have DDL privileges (CREATE, ALTER, DROP).
 *   The app user (POSTGRES_URL, MSSQL_USER, MONGO_URI) is read/write only; using it for
 *   migrations will fail with a permissions error.
 *   If migrate-specific vars are not set, the CLI falls back to the app user vars, which
 *   works for fresh installs but fails on ALTER/DROP in subsequent migrations.
 */
export interface CliEnv {
  postgresUrl: string | undefined;
  /** Dedicated DDL-privileged URL for Postgres migrations. Falls back to postgresUrl. */
  postgresMigrateUrl: string | undefined;
  mssqlServer: string | undefined;
  mssqlDatabase: string | undefined;
  mssqlTrustedConnection: boolean;
  mssqlUser: string | undefined;
  mssqlPassword: string | undefined;
  /** DDL-privileged user for MSSQL migrations. Falls back to mssqlUser. */
  mssqlMigrateUser: string | undefined;
  /** DDL-privileged password for MSSQL migrations. Falls back to mssqlPassword. */
  mssqlMigratePassword: string | undefined;
  mongoUri: string | undefined;
  mongoDatabase: string | undefined;
  /** DDL-privileged URI for MongoDB migrations. Falls back to mongoUri. */
  mongoMigrateUri: string | undefined;
}

/* eslint-disable no-restricted-syntax -- CLI reads process.env directly; no config framework available at bootstrap */
export function readEnv(): CliEnv {
  return {
    postgresUrl: process.env['POSTGRES_DIRECT_URL'] ?? process.env['POSTGRES_URL'],
    postgresMigrateUrl:
      process.env['POSTGRES_MIGRATE_URL'] ??
      process.env['POSTGRES_DIRECT_URL'] ??
      process.env['POSTGRES_URL'],
    mssqlServer: process.env['MSSQL_SERVER'],
    mssqlDatabase: process.env['MSSQL_DATABASE'],
    mssqlTrustedConnection: process.env['MSSQL_TRUSTED_CONNECTION'] === 'true',
    mssqlUser: process.env['MSSQL_USER'],
    mssqlPassword: process.env['MSSQL_PASSWORD'],
    mssqlMigrateUser: process.env['MSSQL_MIGRATE_USER'] ?? process.env['MSSQL_USER'],
    mssqlMigratePassword: process.env['MSSQL_MIGRATE_PASSWORD'] ?? process.env['MSSQL_PASSWORD'],
    mongoUri: process.env['MONGO_URI'],
    mongoDatabase: process.env['MONGO_DATABASE'],
    mongoMigrateUri: process.env['MONGO_MIGRATE_URI'] ?? process.env['MONGO_URI'],
  };
}
/* eslint-enable no-restricted-syntax */
