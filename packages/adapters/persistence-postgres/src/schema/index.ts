// Barrel re-export for all Drizzle schema definitions.
// As platform domain modules add tables (Auth, Projects, Artifacts, …),
// their schema files are imported here so drizzle-kit can see the full schema.

export { standardColumns, tenantColumns } from './_common.js';
