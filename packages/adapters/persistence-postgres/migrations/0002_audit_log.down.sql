-- Down: 0002_audit_log
-- Drops audit_log, audit_chain_state, and all associated indexes.

DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS audit_chain_state CASCADE;
