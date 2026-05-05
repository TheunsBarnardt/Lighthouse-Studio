-- Rollback: 0005_idempotency_records

DROP INDEX IF EXISTS idx_idempotency_workspace;
DROP INDEX IF EXISTS idx_idempotency_expires;
DROP TABLE IF EXISTS idempotency_records;
