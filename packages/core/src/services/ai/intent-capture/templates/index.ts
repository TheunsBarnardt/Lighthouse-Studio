import type { IntentBriefTemplate } from '../types.js';

/**
 * Built-in intent brief templates.
 *
 * These are the platform's seed templates — shipped with the platform, workspace_id = null,
 * built_in = true. They reduce blank-page paralysis by providing starter conversations for
 * the most common project types.
 *
 * Per Objective 21 §5.8: "Templates aren't constraints — they're starting points."
 */

const now = new Date(0); // static sentinel; real rows use DB timestamps

export const BUILT_IN_TEMPLATES: ReadonlyArray<Omit<IntentBriefTemplate, '_version' | '_archivedAt' | '_createdAt' | '_updatedAt'>> = [
  {
    id: 'builtin-blank',
    workspaceId: null,
    name: 'Blank',
    description: 'Start with an empty conversation. Best when you already know what you want to say.',
    category: 'general',
    starterMessage:
      "Tell me about the project you'd like to build. What problem does it solve, and who is it for?",
    suggestedFocusAreas: [
      'What is the core problem being solved?',
      'Who are the primary users?',
      'What does success look like in 6 months?',
    ],
    builtIn: true,
    createdByUserId: null,
  },
  {
    id: 'builtin-web-app',
    workspaceId: null,
    name: 'SaaS Web Application',
    description:
      'Multi-tenant web app with user authentication, a dashboard, and CRUD features. Good for B2B or B2C SaaS products.',
    category: 'technical',
    starterMessage:
      "I want to build a SaaS web application. It will have user authentication, a dashboard, and core CRUD features for [describe your main data/workflow]. The target customers are [individuals / small businesses / enterprises], and the main pain point I'm solving is…",
    suggestedFocusAreas: [
      'What CRUD entities drive the core product value?',
      'Multi-tenant isolation requirements (shared DB vs. per-tenant)?',
      'Subscription / billing model?',
      'Key dashboard metrics for users?',
    ],
    builtIn: true,
    createdByUserId: null,
  },
  {
    id: 'builtin-api-service',
    workspaceId: null,
    name: 'Backend API Service',
    description:
      'REST or GraphQL API with authentication, data models, and deployment pipeline. Good for platform APIs, microservices, or developer-facing products.',
    category: 'technical',
    starterMessage:
      "I want to build a backend API service. It will expose [REST / GraphQL] endpoints for [describe the domain: e.g., payments, user profiles, inventory]. Consumers of the API will be [web clients / mobile apps / third-party integrators / internal services]. The main challenge I'm designing around is…",
    suggestedFocusAreas: [
      'Authentication strategy (API keys, OAuth, JWT)?',
      'Primary data models and their relationships?',
      'Rate limiting and quota requirements?',
      'Deployment target (cloud provider, containerised, serverless)?',
    ],
    builtIn: true,
    createdByUserId: null,
  },
  {
    id: 'builtin-mobile-app',
    workspaceId: null,
    name: 'Mobile Application',
    description:
      'iOS and/or Android app with screens, offline support, and push notifications. Good for consumer apps, field-worker tools, or companion apps.',
    category: 'mobile',
    starterMessage:
      "I want to build a mobile application for [iOS / Android / both]. The primary user is [describe the persona] and the core workflow they'll do on the app is [describe the main action: e.g., logging expenses, tracking deliveries, booking appointments]. The most important UX constraint is…",
    suggestedFocusAreas: [
      'Offline-first or online-only?',
      'Push notification use cases?',
      'Native device features needed (camera, GPS, biometrics)?',
      'App store distribution vs. enterprise MDM?',
    ],
    builtIn: true,
    createdByUserId: null,
  },
  {
    id: 'builtin-data-pipeline',
    workspaceId: null,
    name: 'Data Pipeline / ETL',
    description:
      'ETL or ELT pipeline with sources, transformations, sinks, and scheduling. Good for analytics, reporting, or data migration projects.',
    category: 'analytics',
    starterMessage:
      "I want to build a data pipeline. The sources are [list data sources: e.g., Postgres DB, Salesforce, S3 files], the transformations include [summarise / join / clean / enrich], and the sink is [data warehouse / BI tool / downstream API]. The pipeline needs to run [on a schedule / in near-real-time / triggered by events]. The biggest data quality concern is…",
    suggestedFocusAreas: [
      'Volume: rows per run, data size?',
      'Latency requirements (batch daily vs. near-real-time)?',
      'Schema evolution strategy?',
      'Failure handling and re-run semantics?',
    ],
    builtIn: true,
    createdByUserId: null,
  },
  {
    id: 'builtin-internal-tool',
    workspaceId: null,
    name: 'Internal Business Tool',
    description:
      'Admin panel, operational dashboard, or internal workflow tool. Good for replacing spreadsheets, improving ops, or surfacing data to non-technical teams.',
    category: 'internal',
    starterMessage:
      "I want to build an internal tool for [team name: e.g., operations, finance, customer support]. Right now the team uses [describe current process: spreadsheets, manual emails, a third-party tool] but it's painful because [describe the friction]. The main actions users need to do are [list the 3–5 core tasks: e.g., approve requests, view reports, manage records].",
    suggestedFocusAreas: [
      'Who are the internal users and what roles do they have?',
      'What data does the tool need to read or write?',
      'Integration with existing internal systems?',
      'Access control requirements (who sees what)?',
    ],
    builtIn: true,
    createdByUserId: null,
  },
];

/**
 * Returns the full template objects with placeholder timestamps.
 * Used for seeding the database and for in-memory repos in tests.
 */
export function getBuiltInTemplates(): IntentBriefTemplate[] {
  return BUILT_IN_TEMPLATES.map((t) => ({
    ...t,
    _version: 1,
    _archivedAt: null,
    _createdAt: now,
    _updatedAt: now,
  }));
}
