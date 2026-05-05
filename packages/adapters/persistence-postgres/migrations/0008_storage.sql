-- Migration 0008: storage
-- Five tables backing the Storage Browser & File Management module (Objective 15).
-- Blobs live in object storage; these tables hold metadata, ACLs, signed-URL tokens, and quota state.

-- ── storage_buckets ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS storage_buckets (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  _version            INTEGER       NOT NULL DEFAULT 1,
  workspace_id        UUID          NOT NULL,
  name                VARCHAR(255)  NOT NULL,
  slug                VARCHAR(128)  NOT NULL,
  description         TEXT,
  -- { roleId: ['read','write'] } — sparse JSON
  default_role_grants JSONB         NOT NULL DEFAULT '{}',
  default_pii_flag    BOOLEAN       NOT NULL DEFAULT FALSE,
  storage_class       VARCHAR(32)   NOT NULL DEFAULT 'standard'
                        CHECK (storage_class IN ('standard', 'infrequent', 'archive')),
  metadata            JSONB         NOT NULL DEFAULT '{}',
  _archived_at        TIMESTAMPTZ,
  _created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  _updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  _created_by         UUID,
  CONSTRAINT uq_storage_bucket_workspace_slug UNIQUE (workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_storage_buckets_workspace
  ON storage_buckets (workspace_id)
  WHERE _archived_at IS NULL;

-- ── file_records ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS file_records (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  _version            INTEGER       NOT NULL DEFAULT 1,
  workspace_id        UUID          NOT NULL,
  bucket_id           UUID          NOT NULL REFERENCES storage_buckets (id) ON DELETE CASCADE,
  -- Full path in object storage backend
  storage_key         TEXT          NOT NULL,
  filename            VARCHAR(512)  NOT NULL,
  -- Logical folder path within the bucket ('' = root)
  folder_path         TEXT          NOT NULL DEFAULT '',
  size_bytes          BIGINT        NOT NULL CHECK (size_bytes >= 0),
  content_type        VARCHAR(255),
  etag                VARCHAR(128),
  uploader_user_id    UUID,
  -- Flat array of user-defined tag strings
  tags                TEXT[]        NOT NULL DEFAULT '{}',
  custom_metadata     JSONB         NOT NULL DEFAULT '{}',
  pii_flag            BOOLEAN       NOT NULL DEFAULT FALSE,
  pii_categories      TEXT[]        NOT NULL DEFAULT '{}',
  status              VARCHAR(32)   NOT NULL DEFAULT 'available'
                        CHECK (status IN ('uploading', 'available', 'archiving', 'deleted')),
  _archived_at        TIMESTAMPTZ,
  _created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  _updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Primary query: list files within a bucket/folder
CREATE INDEX IF NOT EXISTS idx_file_records_bucket_folder
  ON file_records (workspace_id, bucket_id, folder_path)
  WHERE _archived_at IS NULL;

-- Filename search within a workspace
CREATE INDEX IF NOT EXISTS idx_file_records_workspace_filename
  ON file_records (workspace_id, filename)
  WHERE _archived_at IS NULL;

-- Uploader lookups
CREATE INDEX IF NOT EXISTS idx_file_records_uploader
  ON file_records (uploader_user_id)
  WHERE uploader_user_id IS NOT NULL AND _archived_at IS NULL;

-- ── file_acls ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS file_acls (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  _version    INTEGER     NOT NULL DEFAULT 1,
  file_id     UUID        NOT NULL REFERENCES file_records (id) ON DELETE CASCADE,
  -- { 'user:<id>' | 'role:<id>': ['read', 'write'] }
  acl         JSONB       NOT NULL DEFAULT '{}',
  _created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  _updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_file_acl_file UNIQUE (file_id)
);

-- ── signed_urls ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS signed_urls (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID          NOT NULL,
  file_id             UUID          NOT NULL REFERENCES file_records (id) ON DELETE CASCADE,
  -- SHA-256 hex of the plain token; stored for revocation lookups
  token_hash          CHAR(64)      NOT NULL,
  created_by_user_id  UUID,
  expires_at          TIMESTAMPTZ   NOT NULL,
  revoked_at          TIMESTAMPTZ,
  download_limit      INTEGER       CHECK (download_limit > 0),
  download_count      INTEGER       NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  description         TEXT,
  -- TRUE = token points directly at storage backend (non-revocable)
  direct_mode         BOOLEAN       NOT NULL DEFAULT FALSE,
  _created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_signed_url_token UNIQUE (token_hash)
);

-- Resolve-path: look up active token by hash
CREATE INDEX IF NOT EXISTS idx_signed_urls_active
  ON signed_urls (token_hash)
  WHERE revoked_at IS NULL AND expires_at > NOW();

-- Cleanup: find expired tokens efficiently
CREATE INDEX IF NOT EXISTS idx_signed_urls_expires
  ON signed_urls (expires_at);

-- Per-file listing
CREATE INDEX IF NOT EXISTS idx_signed_urls_file
  ON signed_urls (file_id);

-- ── storage_quotas ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS storage_quotas (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  _version              INTEGER     NOT NULL DEFAULT 1,
  workspace_id          UUID        NOT NULL,
  quota_bytes           BIGINT      NOT NULL DEFAULT 10737418240, -- 10 GiB default
  used_bytes            BIGINT      NOT NULL DEFAULT 0 CHECK (used_bytes >= 0),
  warning_sent_80       BOOLEAN     NOT NULL DEFAULT FALSE,
  warning_sent_95       BOOLEAN     NOT NULL DEFAULT FALSE,
  last_reconciled_at    TIMESTAMPTZ,
  _created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  _updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_storage_quota_workspace UNIQUE (workspace_id)
);

-- ── Permissions ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE ON storage_buckets TO app_user;
    GRANT SELECT, INSERT, UPDATE ON file_records TO app_user;
    GRANT SELECT, INSERT, UPDATE ON file_acls TO app_user;
    GRANT SELECT, INSERT, UPDATE ON signed_urls TO app_user;
    GRANT SELECT, INSERT, UPDATE ON storage_quotas TO app_user;
  END IF;
END $$;
