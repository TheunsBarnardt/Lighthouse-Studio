-- Identity schema for the platform's built-in user directory and session management.
-- Run once (idempotent) before the application starts.

CREATE TABLE IF NOT EXISTS identity_users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_email   TEXT        NOT NULL,
  email_verified  BOOLEAN     NOT NULL DEFAULT FALSE,
  display_name    TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending_verification'
                              CHECK (status IN ('active', 'pending_verification', 'archived')),
  archived_at     TIMESTAMPTZ,
  mfa_enabled     BOOLEAN     NOT NULL DEFAULT FALSE,
  preferences     JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS identity_users_email_uq
  ON identity_users (LOWER(primary_email))
  WHERE status != 'archived';

-- Federated identities linked to a user (one per provider/subject pair)
CREATE TABLE IF NOT EXISTS identity_identities (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
  provider_id     TEXT        NOT NULL,
  subject         TEXT        NOT NULL,
  email           TEXT,
  email_verified  BOOLEAN     NOT NULL DEFAULT FALSE,
  is_primary      BOOLEAN     NOT NULL DEFAULT FALSE,
  linked_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at    TIMESTAMPTZ,
  UNIQUE (provider_id, subject)
);

CREATE INDEX IF NOT EXISTS identity_identities_user_id_idx
  ON identity_identities (user_id);

-- Credential store: passwords, MFA secrets, lockout state
-- One row per user; created on first credential write.
CREATE TABLE IF NOT EXISTS identity_credentials (
  user_id              UUID        PRIMARY KEY REFERENCES identity_users(id) ON DELETE CASCADE,
  password_hash        TEXT,
  password_version     INTEGER,
  password_algorithm   TEXT,
  mfa_ciphertext       TEXT,
  mfa_key_version      TEXT,
  recovery_codes       TEXT[]      NOT NULL DEFAULT '{}',
  failed_login_count   INTEGER     NOT NULL DEFAULT 0,
  last_failed_login_at TIMESTAMPTZ,
  lockout_until        TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessions with opaque token (stored as HMAC-SHA256 hash, never plaintext)
CREATE TABLE IF NOT EXISTS identity_sessions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES identity_users(id) ON DELETE CASCADE,
  token_hash        TEXT        NOT NULL UNIQUE,
  identity_provider TEXT        NOT NULL DEFAULT 'builtin',
  workspace_id      UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL,
  ip_address        TEXT,
  user_agent        TEXT,
  metadata          JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS identity_sessions_user_id_idx
  ON identity_sessions (user_id);

CREATE INDEX IF NOT EXISTS identity_sessions_expires_at_idx
  ON identity_sessions (expires_at);
