import type { PrdTemplate } from '../types.js';

export const crmTemplate: PrdTemplate = {
  id: 'builtin.crm',
  name: 'CRM / Sales Platform',
  description:
    'Starter structure for customer relationship management and sales pipeline applications. Emphasizes contact management, deal progression, and sales reporting.',
  category: 'sales_and_crm',
  builtIn: true,
  sectionStarters: {
    overview:
      'This CRM platform centralises customer data, tracks sales pipelines, and enables teams to manage relationships at scale. Core capabilities include contact and company records, deal management with configurable pipeline stages, activity tracking (calls, emails, meetings), and reporting dashboards for sales managers and executives.',

    goals_and_success_metrics:
      'Common CRM goals include: reducing average deal cycle time, improving lead conversion rates, increasing sales team productivity through reduced manual data entry, and providing managers with real-time pipeline visibility. Success metrics typically include deal win rate, average deal cycle length, pipeline value by stage, and activity volume per sales rep.',

    target_users_and_personas:
      'Typical CRM personas: (1) Sales Rep — owns individual deals and contacts, uses the system daily to log activities and progress deals through stages; (2) Sales Manager — reviews team pipelines, reassigns deals, monitors performance via dashboards; (3) Customer Success Manager — manages post-sale relationships, tracks renewal dates and health scores; (4) Marketing Team — creates campaigns, tracks lead sources, measures campaign-to-deal attribution; (5) System Administrator — configures pipeline stages, custom fields, and user permissions.',

    user_stories:
      'Common CRM user stories: sales reps logging calls and setting follow-up reminders, managers viewing team pipelines and reassigning stalled deals, importing contacts from CSV or LinkedIn, creating deals from inbound email, bulk-updating contact fields, setting deal close dates and probability scores, exporting pipeline data to Excel for board reporting.',

    functional_requirements:
      'Core CRM functional areas: contact and company record management with custom fields, deal management with pipeline stage progression and probability tracking, activity logging (calls, emails, meetings, notes) with reminders, bulk import via CSV with field mapping, email integration for activity capture, user and team management with role-based visibility, reporting on pipeline value by stage and rep, dashboard widgets for key metrics, duplicate detection and merge for contacts.',

    non_functional_requirements:
      'CRM-specific NFRs: list views must load within 1 second for up to 50,000 contacts; search results must return within 500ms; deal pipeline page must support concurrent editing by multiple sales reps without data loss (optimistic locking); data export must complete within 30 seconds for up to 10,000 records; API must support bulk operations (up to 500 records per request).',

    constraints_and_assumptions:
      'Typical CRM constraints: initial deployment supports a single currency; multi-currency and multi-language support are future phases. Assumes users have a modern browser; no native mobile app in scope for v1. Email integration assumes OAuth with Google Workspace and Microsoft 365; SMTP-only integrations are out of scope.',

    out_of_scope:
      'Commonly out of scope for CRM v1: native mobile applications, customer-facing portals, invoice and billing generation, contract management, multi-currency support, territory management and quota allocation, AI-driven lead scoring and forecasting, call recording and transcription.',

    open_questions:
      'Questions commonly left open at CRM PRD stage: Should pipeline stages be global (shared across all sales teams) or configurable per team? What is the data retention policy for closed/lost deals? Is email open tracking required (privacy implications)? Should contact deduplication be automatic or require manual review?',

    risks_and_mitigations:
      'CRM-specific risks: data quality — CRM value depends on data completeness; mitigate with mandatory fields, validation rules, and completeness scores. User adoption — sales reps resist tools that slow them down; mitigate with fast list views, keyboard shortcuts, and minimal required fields. Data migration — moving contacts from legacy CRM may surface deduplication challenges; mitigate with a staged migration plan and parallel running period.',
  },
};
