-- Development init: create application and migration roles.
-- Production uses separate IAM / secret management.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'platform_app') THEN
    CREATE ROLE platform_app WITH LOGIN PASSWORD 'platform_app_dev';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'platform_migrate') THEN
    CREATE ROLE platform_migrate WITH LOGIN PASSWORD 'platform_migrate_dev' REPLICATION;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE platform TO platform_app;
GRANT CONNECT ON DATABASE platform TO platform_migrate;

-- Grant schema-level permissions
\c platform
GRANT USAGE, CREATE ON SCHEMA public TO platform_migrate;
GRANT USAGE ON SCHEMA public TO platform_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO platform_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO platform_app;
