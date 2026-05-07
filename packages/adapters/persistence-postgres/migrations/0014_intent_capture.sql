-- Migration 0014: intent_capture
-- Creates the intent_brief_templates table for Objective 21 (Stage 1 Intent Capture).
-- Built-in templates are seeded below.

CREATE TABLE IF NOT EXISTS intent_brief_templates (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID,
  -- NULL = installation-wide built-in
  name                    VARCHAR(255)  NOT NULL,
  description             TEXT          NOT NULL DEFAULT '',
  category                VARCHAR(100)  NOT NULL DEFAULT 'general',
  starter_message         TEXT          NOT NULL,
  suggested_focus_areas   JSONB         NOT NULL DEFAULT '[]',
  built_in                BOOLEAN       NOT NULL DEFAULT FALSE,
  created_by_user_id      UUID,
  _version                INTEGER       NOT NULL DEFAULT 1,
  _archived_at            TIMESTAMPTZ,
  _created_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  _updated_at             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Workspace-scoped templates must have unique names per workspace
CREATE UNIQUE INDEX IF NOT EXISTS intent_brief_templates_workspace_name_idx
  ON intent_brief_templates(workspace_id, name)
  WHERE workspace_id IS NOT NULL AND _archived_at IS NULL;

-- Built-in templates must have globally unique names
CREATE UNIQUE INDEX IF NOT EXISTS intent_brief_templates_builtin_name_idx
  ON intent_brief_templates(name)
  WHERE workspace_id IS NULL AND built_in = TRUE AND _archived_at IS NULL;

CREATE INDEX IF NOT EXISTS intent_brief_templates_workspace_idx
  ON intent_brief_templates(workspace_id)
  WHERE _archived_at IS NULL;

CREATE INDEX IF NOT EXISTS intent_brief_templates_category_idx
  ON intent_brief_templates(category)
  WHERE _archived_at IS NULL;

-- ── Seed built-in templates ───────────────────────────────────────────────────

INSERT INTO intent_brief_templates
  (name, description, category, starter_message, suggested_focus_areas, built_in)
VALUES
  (
    'CRM System',
    'Customer relationship management tool to track leads, contacts, and deals.',
    'business',
    'I want to build a customer relationship management tool. The main pain point I''m solving is [difficulty tracking customer interactions / losing leads in spreadsheets / no visibility into the sales pipeline / something else]. The business that will use this is [describe the business].',
    '["What types of contacts and companies are being tracked?", "What is the core sales workflow (lead → opportunity → deal)?", "What integrations are needed (email, calendar, billing)?", "How many users will use this concurrently?"]',
    TRUE
  ),
  (
    'Blog & Content Platform',
    'Content publishing platform for articles, newsletters, or media.',
    'content',
    'I want to build a content publishing platform. My audience is [describe readers] and the type of content will be [blog posts / newsletters / documentation / media]. The main gap from existing tools is [describe what''s missing].',
    '["Who creates content vs. who reads it?", "What publishing workflow is needed (draft → review → publish)?", "Are there monetization or subscription requirements?", "What SEO or distribution channels matter?"]',
    TRUE
  ),
  (
    'Task & Project Tracker',
    'Internal tool for managing tasks, projects, and team workflows.',
    'productivity',
    'I want to build a task and project management tool. The team using it is [describe team size/type] and the current pain point with existing tools is [too complex / wrong workflow / missing integrations / something else].',
    '["What is the core unit of work (task, ticket, card, story)?", "What project or workflow structure is needed (boards, sprints, milestones)?", "How should assignments and deadlines work?", "What reporting or status visibility is needed?"]',
    TRUE
  ),
  (
    'E-Commerce Store',
    'Online store with product catalog, cart, and checkout.',
    'commerce',
    'I want to build an e-commerce platform. I''m selling [describe products: physical goods / digital downloads / subscriptions]. The key differentiator from Shopify or WooCommerce is [describe what''s different about this use case].',
    '["What is the product catalog structure (categories, variants, SKUs)?", "What payment providers need to be integrated?", "What shipping or fulfillment workflows are required?", "B2B or B2C, or both?"]',
    TRUE
  ),
  (
    'Internal Tool / Admin Panel',
    'Back-office tool for internal operations, data management, or workflows.',
    'internal',
    'I want to build an internal admin or operations tool. The team using it is [describe role: ops, support, finance, etc.]. The core job-to-be-done is [manage customer data / process orders / approve requests / run reports / something else].',
    '["What data sources does this tool read from or write to?", "What manual processes is this replacing?", "What approval or audit trail requirements exist?", "Who has what level of access?"]',
    TRUE
  ),
  (
    'Customer Portal',
    'Self-service portal where customers can manage their account or service.',
    'customer-facing',
    'I want to build a customer self-service portal. My customers are [describe: end consumers / business clients / partners] and they need to be able to [manage their account / track orders / submit requests / access documents / something else] without contacting support.',
    '["What actions can customers take in the portal?", "What data do they see about their account or history?", "How does authentication work (invite-only / self-registration / SSO)?", "What notifications or communications are triggered?"]',
    TRUE
  ),
  (
    'API Service',
    'Backend API or microservice for integration or platform capabilities.',
    'technical',
    'I want to build an API or service. This API will be consumed by [internal apps / third-party integrators / mobile apps / other services] and the primary operations it needs to support are [describe: CRUD for X / webhooks / data processing / real-time events].',
    '["What are the core resources and operations (endpoints)?", "What authentication method is required (API keys, OAuth, JWT)?", "What are the rate limiting and SLA requirements?", "What developer experience is needed (SDKs, docs, sandbox)?"]',
    TRUE
  ),
  (
    'Mobile App',
    'iOS/Android application with a backend API.',
    'mobile',
    'I want to build a mobile app. The target platform is [iOS / Android / both] and the app will help users [describe primary user action]. The core problem it solves that existing apps don''t is [describe gap].',
    '["What are the 3 most important user flows?", "Does it need offline support?", "What notifications or background tasks are required?", "What device hardware features (camera, GPS, biometrics) are needed?"]',
    TRUE
  ),
  (
    'Data Dashboard',
    'Analytics or reporting dashboard that visualizes business data.',
    'analytics',
    'I want to build a data visualization dashboard. The audience is [describe: executives / operations / customers] and the key metrics or reports they need are [describe 2-3 key charts or tables]. The data source is [describe: database / APIs / flat files / data warehouse].',
    '["What data sources feed the dashboard?", "What is the refresh cadence (real-time / hourly / daily)?", "What level of interactivity is needed (filters, drill-downs, exports)?", "Who can see what (access control by role or tenant)?"]',
    TRUE
  ),
  (
    'Legacy System Migration',
    'Replacement for an existing system with data migration required.',
    'migration',
    'I want to replace an existing system. The system being replaced is [describe: old CRM / custom-built tool / outdated SaaS product] and the reasons for replacing it are [too expensive / unsupported / missing features / bad UX]. The existing data that needs to migrate is [describe: approx. records, key entities].',
    '["What are the must-have features from the old system?", "What features of the old system should NOT be carried over?", "What is the data migration strategy (big bang / parallel run / phased)?", "What is the go-live timeline constraint?"]',
    TRUE
  );
