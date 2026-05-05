/**
 * Read and validate the environment variables needed by the CLI.
 * The CLI requires at least one database URL; MSSQL and Mongo are optional.
 */
export interface CliEnv {
  postgresUrl: string | undefined;
  mssqlServer: string | undefined;
  mssqlDatabase: string | undefined;
  mssqlUser: string | undefined;
  mssqlPassword: string | undefined;
  mongoUri: string | undefined;
  mongoDatabase: string | undefined;
}

/* eslint-disable no-restricted-syntax -- CLI reads process.env directly; no config framework available at bootstrap */
export function readEnv(): CliEnv {
  return {
    postgresUrl: process.env['POSTGRES_DIRECT_URL'] ?? process.env['POSTGRES_URL'],
    mssqlServer: process.env['MSSQL_SERVER'],
    mssqlDatabase: process.env['MSSQL_DATABASE'],
    mssqlUser: process.env['MSSQL_USER'],
    mssqlPassword: process.env['MSSQL_PASSWORD'],
    mongoUri: process.env['MONGO_URI'],
    mongoDatabase: process.env['MONGO_DATABASE'],
  };
}
/* eslint-enable no-restricted-syntax */
