// Minimal ambient shim for the `mssql` package.
// Replace with `@types/mssql` when the dependency is added to apps/web.

declare module 'mssql' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mssql: any;

  export = mssql;
}

// Namespace alias so `mssql.ConnectionPool` works in type positions
// alongside the default-imported value.
declare namespace mssql {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type ConnectionPool = any;
}
