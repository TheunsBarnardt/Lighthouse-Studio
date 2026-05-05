-- Rollback: 0004_api_keys

DROP INDEX IF EXISTS idx_api_keys_prefix;
DROP INDEX IF EXISTS idx_api_keys_workspace;
DROP TABLE IF EXISTS api_keys;
