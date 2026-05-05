-- Migration 0010: Auth & User Management UI (Objective 16)
-- Adds workspace branding and email template override tables.

CREATE TABLE IF NOT EXISTS workspace_branding (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version         INTEGER NOT NULL DEFAULT 1,
  workspace_id    UUID NOT NULL UNIQUE,
  logo_file_id    UUID,
  primary_color   VARCHAR(7),
  company_name    VARCHAR(255),
  custom_css      TEXT,
  email_from_name VARCHAR(255),
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      TEXT NOT NULL,
  updated_by      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workspace_branding_workspace_id ON workspace_branding(workspace_id);

CREATE TABLE IF NOT EXISTS workspace_email_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version          INTEGER NOT NULL DEFAULT 1,
  workspace_id     UUID NOT NULL,
  template_key     VARCHAR(100) NOT NULL,
  subject_template TEXT NOT NULL,
  html_template    TEXT NOT NULL,
  text_template    TEXT,
  archived_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       TEXT NOT NULL,
  updated_by       TEXT NOT NULL,
  UNIQUE (workspace_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_workspace_email_templates_workspace_id ON workspace_email_templates(workspace_id);
