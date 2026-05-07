import type { PrdTemplate } from '../types.js';

export const internalToolTemplate: PrdTemplate = {
  id: 'builtin.internal_tool',
  name: 'Internal Tool / Back-office',
  description:
    'Starter structure for internal tooling and back-office applications used by employees. Emphasizes workflow automation, integration with existing systems, audit logging, and admin controls.',
  category: 'internal_tools',
  builtIn: true,
  sectionStarters: {
    overview:
      'This internal tool streamlines a specific business process currently managed through spreadsheets, email, or a patchwork of legacy systems. Core capabilities include a workflow engine for multi-step approvals, a structured data view for the relevant operational records, integration with the existing identity provider (LDAP/Active Directory), full audit logging for compliance, and an admin interface for configuration.',

    goals_and_success_metrics:
      'Common internal tool goals: reducing the time employees spend on a specific operational process, eliminating error-prone manual steps, providing management with visibility into process status, and ensuring compliance through complete audit trails. Success metrics: average process completion time (before vs. after), error rate per process run, percentage of processes completed without escalation, audit report generation time.',

    target_users_and_personas:
      'Typical internal tool personas: (1) Operational Employee — completes the core workflow daily; wants speed and minimal friction; may have low technical proficiency with software; (2) Team Lead / Manager — reviews pending approvals, monitors team workload and throughput, resolves exceptions; (3) System Administrator — manages user accounts, configures workflow rules, manages integrations with other internal systems; (4) Compliance Officer — runs audit reports, reviews approval history, ensures policy adherence; (5) Executive Viewer — read-only access to summary dashboards and KPIs.',

    user_stories:
      'Common internal tool user stories: employee submits a request that enters a review queue; manager receives a notification and approves or rejects with a comment; employee is notified of the outcome; manager bulk-approves pending items from a list view; admin configures which roles can approve which request types; compliance officer exports an audit report for a date range; admin syncs user accounts from Active Directory.',

    functional_requirements:
      'Core internal tool functional areas: SSO / LDAP integration for authentication (no separate account creation); role-based access control with admin-configurable roles; workflow engine with configurable approval steps, escalation rules, and SLA timers; list views with filtering, sorting, and bulk actions; full audit log for all state changes (immutable, queryable); notification system (in-app and email) for workflow events; admin configuration panel for workflow rules and user management; data export to CSV for reporting.',

    non_functional_requirements:
      "Internal tool NFRs: must integrate with the organisation's existing LDAP or Active Directory for authentication; user provisioning must reflect directory changes within 15 minutes of a change in the directory; audit log must be immutable and retained for 7 years per compliance requirements; the application must be deployable on-premise on the company's internal network with no external dependencies; all data must remain within the corporate network boundary.",

    constraints_and_assumptions:
      "Internal tool constraints: the application must run on the company's internal network; internet access from the server cannot be assumed. Authentication uses the existing Active Directory; separate user accounts are not in scope. The application must support the company's standard browser (Internet Explorer compatibility is often a constraint in enterprise environments — confirm). Database is the company's existing SQL Server instance. No external SaaS dependencies are permitted.",

    out_of_scope:
      'Commonly out of scope for internal tools v1: mobile access, external user access (customers or partners), complex report builder (static predefined reports only), integration with all internal systems (only the most critical integrations in v1), real-time collaboration features, AI-assisted processing, self-service onboarding for new business units.',

    open_questions:
      'Questions commonly left open at internal tool PRD stage: What are the data retention requirements for completed workflow records? Does the compliance team require read-only access to the production database, or is a reporting export sufficient? Should the workflow rules be user-configurable via the admin panel, or are they fixed at deploy time for the first version? Is two-factor authentication required in addition to LDAP?',

    risks_and_mitigations:
      'Internal tool risks: LDAP integration complexity — directory structures vary significantly between organisations; mitigate with a flexible LDAP configuration panel and fallback to manual user provisioning. Change resistance — employees are accustomed to existing processes even when they are painful; mitigate with early stakeholder involvement and a parallel-running period. Compliance gaps — internal tools often face stricter audit requirements than consumer software; mitigate with a compliance review of the audit log design before implementation begins.',
  },
};
