import type { Db } from 'mongodb';

import type { MongoMigration } from '../src/migrate.js';

const migration: MongoMigration = {
  async up(db: Db): Promise<void> {
    // ── intent_brief_templates ────────────────────────────────────────────────

    const templates = db.collection('intent_brief_templates');

    await templates.createIndex(
      { workspace_id: 1 },
      { sparse: true, name: 'idx_intent_brief_templates_workspace' },
    );

    await templates.createIndex({ category: 1 }, { name: 'idx_intent_brief_templates_category' });

    // Unique index for built-in templates by name (workspace_id null)
    await templates.createIndex(
      { name: 1 },
      {
        unique: true,
        partialFilterExpression: { workspace_id: null, built_in: true, _archived_at: null },
        name: 'idx_intent_brief_templates_builtin_name',
      },
    );

    // Seed built-in templates
    const builtInTemplates = [
      {
        workspace_id: null,
        name: 'CRM System',
        description: 'Customer relationship management tool to track leads, contacts, and deals.',
        category: 'business',
        starter_message:
          "I want to build a customer relationship management tool. The main pain point I'm solving is [difficulty tracking customer interactions / losing leads in spreadsheets / no visibility into the sales pipeline / something else]. The business that will use this is [describe the business].",
        suggested_focus_areas: [
          'What types of contacts and companies are being tracked?',
          'What is the core sales workflow (lead → opportunity → deal)?',
          'What integrations are needed (email, calendar, billing)?',
          'How many users will use this concurrently?',
        ],
        built_in: true,
        _version: 1,
        _archived_at: null,
        _created_at: new Date(),
        _updated_at: new Date(),
      },
      {
        workspace_id: null,
        name: 'Blog & Content Platform',
        description: 'Content publishing platform for articles, newsletters, or media.',
        category: 'content',
        starter_message:
          "I want to build a content publishing platform. My audience is [describe readers] and the type of content will be [blog posts / newsletters / documentation / media]. The main gap from existing tools is [describe what's missing].",
        suggested_focus_areas: [
          'Who creates content vs. who reads it?',
          'What publishing workflow is needed (draft → review → publish)?',
          'Are there monetization or subscription requirements?',
          'What SEO or distribution channels matter?',
        ],
        built_in: true,
        _version: 1,
        _archived_at: null,
        _created_at: new Date(),
        _updated_at: new Date(),
      },
      {
        workspace_id: null,
        name: 'Task & Project Tracker',
        description: 'Internal tool for managing tasks, projects, and team workflows.',
        category: 'productivity',
        starter_message:
          'I want to build a task and project management tool. The team using it is [describe team size/type] and the current pain point with existing tools is [too complex / wrong workflow / missing integrations / something else].',
        suggested_focus_areas: [
          'What is the core unit of work (task, ticket, card, story)?',
          'What project or workflow structure is needed (boards, sprints, milestones)?',
          'How should assignments and deadlines work?',
          'What reporting or status visibility is needed?',
        ],
        built_in: true,
        _version: 1,
        _archived_at: null,
        _created_at: new Date(),
        _updated_at: new Date(),
      },
      {
        workspace_id: null,
        name: 'E-Commerce Store',
        description: 'Online store with product catalog, cart, and checkout.',
        category: 'commerce',
        starter_message:
          "I want to build an e-commerce platform. I'm selling [describe products: physical goods / digital downloads / subscriptions]. The key differentiator from Shopify or WooCommerce is [describe what's different about this use case].",
        suggested_focus_areas: [
          'What is the product catalog structure (categories, variants, SKUs)?',
          'What payment providers need to be integrated?',
          'What shipping or fulfillment workflows are required?',
          'B2B or B2C, or both?',
        ],
        built_in: true,
        _version: 1,
        _archived_at: null,
        _created_at: new Date(),
        _updated_at: new Date(),
      },
      {
        workspace_id: null,
        name: 'Internal Tool / Admin Panel',
        description: 'Back-office tool for internal operations, data management, or workflows.',
        category: 'internal',
        starter_message:
          'I want to build an internal admin or operations tool. The team using it is [describe role: ops, support, finance, etc.]. The core job-to-be-done is [manage customer data / process orders / approve requests / run reports / something else].',
        suggested_focus_areas: [
          'What data sources does this tool read from or write to?',
          'What manual processes is this replacing?',
          'What approval or audit trail requirements exist?',
          'Who has what level of access?',
        ],
        built_in: true,
        _version: 1,
        _archived_at: null,
        _created_at: new Date(),
        _updated_at: new Date(),
      },
      {
        workspace_id: null,
        name: 'Customer Portal',
        description: 'Self-service portal where customers can manage their account or service.',
        category: 'customer-facing',
        starter_message:
          'I want to build a customer self-service portal. My customers are [describe: end consumers / business clients / partners] and they need to be able to [manage their account / track orders / submit requests / access documents / something else] without contacting support.',
        suggested_focus_areas: [
          'What actions can customers take in the portal?',
          'What data do they see about their account or history?',
          'How does authentication work (invite-only / self-registration / SSO)?',
          'What notifications or communications are triggered?',
        ],
        built_in: true,
        _version: 1,
        _archived_at: null,
        _created_at: new Date(),
        _updated_at: new Date(),
      },
      {
        workspace_id: null,
        name: 'API Service',
        description: 'Backend API or microservice for integration or platform capabilities.',
        category: 'technical',
        starter_message:
          'I want to build an API or service. This API will be consumed by [internal apps / third-party integrators / mobile apps / other services] and the primary operations it needs to support are [describe: CRUD for X / webhooks / data processing / real-time events].',
        suggested_focus_areas: [
          'What are the core resources and operations (endpoints)?',
          'What authentication method is required (API keys, OAuth, JWT)?',
          'What are the rate limiting and SLA requirements?',
          'What developer experience is needed (SDKs, docs, sandbox)?',
        ],
        built_in: true,
        _version: 1,
        _archived_at: null,
        _created_at: new Date(),
        _updated_at: new Date(),
      },
      {
        workspace_id: null,
        name: 'Mobile App',
        description: 'iOS/Android application with a backend API.',
        category: 'mobile',
        starter_message:
          "I want to build a mobile app. The target platform is [iOS / Android / both] and the app will help users [describe primary user action]. The core problem it solves that existing apps don't is [describe gap].",
        suggested_focus_areas: [
          'What are the 3 most important user flows?',
          'Does it need offline support?',
          'What notifications or background tasks are required?',
          'What device hardware features (camera, GPS, biometrics) are needed?',
        ],
        built_in: true,
        _version: 1,
        _archived_at: null,
        _created_at: new Date(),
        _updated_at: new Date(),
      },
      {
        workspace_id: null,
        name: 'Data Dashboard',
        description: 'Analytics or reporting dashboard that visualizes business data.',
        category: 'analytics',
        starter_message:
          'I want to build a data visualization dashboard. The audience is [describe: executives / operations / customers] and the key metrics or reports they need are [describe 2-3 key charts or tables]. The data source is [describe: database / APIs / flat files / data warehouse].',
        suggested_focus_areas: [
          'What data sources feed the dashboard?',
          'What is the refresh cadence (real-time / hourly / daily)?',
          'What level of interactivity is needed (filters, drill-downs, exports)?',
          'Who can see what (access control by role or tenant)?',
        ],
        built_in: true,
        _version: 1,
        _archived_at: null,
        _created_at: new Date(),
        _updated_at: new Date(),
      },
      {
        workspace_id: null,
        name: 'Legacy System Migration',
        description: 'Replacement for an existing system with data migration required.',
        category: 'migration',
        starter_message:
          'I want to replace an existing system. The system being replaced is [describe: old CRM / custom-built tool / outdated SaaS product] and the reasons for replacing it are [too expensive / unsupported / missing features / bad UX]. The existing data that needs to migrate is [describe: approx. records, key entities].',
        suggested_focus_areas: [
          'What are the must-have features from the old system?',
          'What features of the old system should NOT be carried over?',
          'What is the data migration strategy (big bang / parallel run / phased)?',
          'What is the go-live timeline constraint?',
        ],
        built_in: true,
        _version: 1,
        _archived_at: null,
        _created_at: new Date(),
        _updated_at: new Date(),
      },
    ];

    for (const template of builtInTemplates) {
      await templates.updateOne(
        { name: template.name, workspace_id: null, built_in: true },
        { $setOnInsert: template },
        { upsert: true },
      );
    }
  },

  async down(db: Db): Promise<void> {
    await db
      .collection('intent_brief_templates')
      .drop()
      .catch(() => undefined);
  },
};

export default migration;
