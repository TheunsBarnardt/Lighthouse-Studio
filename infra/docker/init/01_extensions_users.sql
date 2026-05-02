-- Postgres initialisation script — runs once on first container start.
-- Creates the platform extensions and the two database users.
-- Executed as the POSTGRES_USER (superuser) defined in the Compose stack.

-- ── Extensions ──────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;   -- pgvector; requires pgvector/pgvector image

-- ── Application user (DML only) ─────────────────────────────────────────────
-- Used by the running application via PgBouncer.
-- Has SELECT/INSERT/UPDATE/DELETE on all current and future platform tables.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'platform_app') THEN
    CREATE ROLE platform_app WITH LOGIN PASSWORD 'platform_app';
  END IF;
END $$;

-- ── Migration user (DDL privileges) ─────────────────────────────────────────
-- Used by the migration runner (directPool) only.
-- Has CREATE/ALTER/DROP on the public schema.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'platform_migrate') THEN
    CREATE ROLE platform_migrate WITH LOGIN PASSWORD 'platform_migrate';
  END IF;
END $$;

-- ── Schema grants ────────────────────────────────────────────────────────────

GRANT CONNECT ON DATABASE platform_dev TO platform_app;
GRANT CONNECT ON DATABASE platform_dev TO platform_migrate;

GRANT USAGE ON SCHEMA public TO platform_app;
GRANT ALL   ON SCHEMA public TO platform_migrate;

-- Current tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO platform_app;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO platform_app;
GRANT ALL                            ON ALL TABLES    IN SCHEMA public TO platform_migrate;
GRANT ALL                            ON ALL SEQUENCES IN SCHEMA public TO platform_migrate;

-- Future tables created by platform_migrate will be accessible to platform_app
ALTER DEFAULT PRIVILEGES FOR ROLE platform_migrate IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO platform_app;

ALTER DEFAULT PRIVILEGES FOR ROLE platform_migrate IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO platform_app;
