# ADR-0234: Parameter Binding Only — No String Interpolation

**Status:** Accepted
**Date:** 2026-05-05

## Context

The query console accepts user-supplied parameters for named placeholders (`:name` in SQL, `$name` in MongoDB). Naively substituting these values via string interpolation creates SQL/NoSQL injection vulnerabilities, even from trusted internal users.

## Decision

All parameter substitution uses the database driver's native prepared statement / parameterized query mechanism:

- **PostgreSQL:** Named parameters (`:name`) are converted to positional parameters (`$1`, `$2`) and passed as the `values` array to `pg.query(text, values)`
- **MSSQL:** Named parameters (`:name`) are converted to named T-SQL parameters (`@p1`) and bound via `mssql.Request.input()`
- **MongoDB:** Parameters (`$name`) are substituted into the parsed JSON pipeline object before passing to the driver — no string concatenation

String interpolation into query text is explicitly banned via ESLint rule in the raw query adapter files.

## Consequences

- SQL injection is structurally impossible through the parameter binding path
- Queries containing literal special characters (quotes, semicolons, null bytes) in parameter values are handled safely
- Named-to-positional parameter conversion preserves ordering and deduplication
- Users cannot use parameters to inject table names or column names (intentional — use the editor directly for those)

## Alternatives Considered

**Allow string interpolation with escaping:** Rejected — escaping logic is dialect-specific, error-prone, and historically the source of injection vulnerabilities even when "done correctly."

**Require positional parameters from the start:** Rejected — `:name` syntax is more readable and self-documenting in saved queries; the conversion to positional is a mechanical adapter concern.
