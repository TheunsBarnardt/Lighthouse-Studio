import type { PrdTemplate } from '../types.js';

export const dashboardTemplate: PrdTemplate = {
  id: 'builtin.dashboard',
  name: 'Analytics Dashboard / Reporting',
  description:
    'Starter structure for analytics and reporting dashboards. Emphasizes data visualization, configurable widgets, role-based data access, and export capabilities.',
  category: 'analytics_and_reporting',
  builtIn: true,
  sectionStarters: {
    overview:
      'This analytics dashboard provides teams with a unified view of key business metrics, enabling data-driven decision-making across operational, financial, and product dimensions. Core capabilities include configurable widget-based dashboards, a library of pre-built charts and tables, time-range filtering, drill-down from summary to detail, role-based data access (executives see aggregates; analysts see raw data), and export to CSV and PDF.',

    goals_and_success_metrics:
      'Common dashboard goals: giving managers and executives a real-time view of business performance without requiring ad-hoc data exports, reducing analyst time spent on recurring report generation, enabling self-service data exploration for non-technical stakeholders. Success metrics: reduction in ad-hoc data request volume to the analytics team, dashboard daily active users, percentage of key decisions supported by dashboard data (qualitative), time from data update to dashboard refresh.',

    target_users_and_personas:
      'Typical dashboard personas: (1) Analyst — builds and configures dashboards, defines metrics, writes underlying queries; high technical proficiency; daily user; needs flexibility and raw data access; (2) Manager / Team Lead — reviews team-specific dashboards daily; needs clarity and drill-down capability; moderate technical proficiency; (3) Executive / C-Suite — reviews high-level KPI dashboards; needs summary views, trend indicators, and PDF export for board presentations; low technical engagement with the tool; (4) Dashboard Administrator — manages user access, defines which data sources analysts can query, sets data refresh schedules.',

    user_stories:
      'Common dashboard user stories: analyst creates a new dashboard and adds a bar chart showing revenue by product line; analyst sets a time-range filter that applies to all widgets on the page; manager drills down from a monthly summary to daily data by clicking a bar; executive exports the current dashboard as a PDF with the company logo; analyst shares a dashboard link with a specific colleague; admin grants a manager read-only access to the sales analytics dashboard; analyst saves a custom date range as a preset for reuse.',

    functional_requirements:
      'Core dashboard functional areas: widget library including bar charts, line charts, pie charts, scorecards, tables, and text annotations; configurable dashboard layouts with drag-and-drop widget placement; time-range selector with presets (today, last 7 days, last 30 days, last quarter, custom range); widget-level filters (dimension slicing); drill-down from summary widgets to detail tables; role-based dashboard visibility and data-level access controls; dashboard sharing with view-only links; CSV export per widget and PDF export per dashboard; scheduled email delivery of PDF snapshots; data refresh indicators with "last updated" timestamps.',

    non_functional_requirements:
      'Dashboard NFRs: dashboard initial load must complete within 3 seconds for dashboards with up to 10 widgets; widget data refresh must complete within 5 seconds for queries returning up to 100,000 rows; PDF export must complete within 30 seconds; the system must support 100 concurrent dashboard viewers without degradation; data latency (time from source event to dashboard visibility) must be less than 5 minutes for operational metrics and less than 24 hours for financial metrics.',

    constraints_and_assumptions:
      "Dashboard constraints: data sources are the platform's own databases and event streams; external data source connectors (Google Sheets, Salesforce, etc.) are out of scope for v1. Dashboard widget queries are read-only; the dashboard cannot modify underlying data. Assumes the underlying data warehouse or operational database is available and performant; the dashboard does not perform ETL. Custom SQL in widget queries is an analyst-only feature; manager and executive roles use pre-built widget types only.",

    out_of_scope:
      'Commonly out of scope for dashboard v1: natural language query interface ("ask a question"), AI-generated insight narratives, anomaly detection and alerting (deferred to v2), external data source connectors, embedded dashboards in third-party applications, real-time sub-second data streaming (operational metrics have 5-minute latency), complex cohort analysis and funnel visualizations, mobile-optimized layout.',

    open_questions:
      'Questions commonly left open at dashboard PRD stage: Should analysts be able to write custom SQL for widget queries, or are they restricted to the visual query builder? What is the data retention window for historical metrics? Should dashboards support comments and annotations for collaboration? Is there a requirement for dashboard versioning (the ability to revert to a previous dashboard layout)?',

    risks_and_mitigations:
      'Dashboard risks: query performance — poorly written queries can degrade performance for all users; mitigate with query time limits, resource governors on the analytics database, and a query review process for analyst-authored widgets. Data accuracy perception — if metrics in the dashboard disagree with other sources, trust erodes quickly; mitigate with clear data source labels, "last updated" timestamps, and a reconciliation process for metric definitions. Scope creep — analytics products attract an infinite list of feature requests; mitigate with a clear prioritisation framework and a documented backlog triage process.',
  },
};
