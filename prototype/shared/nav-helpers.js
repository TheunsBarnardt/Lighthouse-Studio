/* =========================================================================
   DATABASE PAGE HELPERS
   Shared context nav config for all database/* pages.
   Each page sets its own activeId and main content.
   ========================================================================= */

window.databaseContextNav = function(activeId) {
  const sections = [
    { heading: 'Database management', items: [
      { id: 'schema-visualizer', label: 'Schema Visualizer', href: 'database-schema-visualizer.html' },
      { id: 'tables', label: 'Tables', href: 'database-tables.html' },
      { id: 'functions', label: 'Functions', href: 'database-functions.html' },
      { id: 'triggers', label: 'Triggers', href: 'database-triggers.html' },
      { id: 'enumerated-types', label: 'Enumerated Types', href: 'database-enumerated-types.html' },
      { id: 'extensions', label: 'Extensions', href: 'database-extensions.html' },
      { id: 'indexes', label: 'Indexes', href: 'database-indexes.html' },
      { id: 'publications', label: 'Publications', href: 'database-publications.html' }
    ]},
    { heading: 'Configuration', items: [
      { id: 'roles', label: 'Roles', href: 'database-roles.html' },
      { id: 'policies', label: 'Policies', href: 'database-policies.html' },
      { id: 'db-settings', label: 'Settings', href: 'database-settings.html' }
    ]},
    { heading: 'Platform', items: [
      { id: 'migrations', label: 'Migrations', href: 'database-migrations.html' },
      { id: 'wrappers', label: 'Wrappers', href: 'database-wrappers.html' },
      { id: 'webhooks', label: 'Database Webhooks', href: 'database-webhooks.html' }
    ]},
    { heading: 'Tools', items: [
      { id: 'security-advisor', label: 'Security Advisor', href: 'database-security-advisor.html' },
      { id: 'performance-advisor', label: 'Performance Advisor', href: 'database-performance-advisor.html' },
      { id: 'query-performance', label: 'Query Performance', href: 'database-query-performance.html' }
    ]}
  ].map(section => ({
    ...section,
    items: section.items.map(item => ({ ...item, active: item.id === activeId }))
  }));

  return { title: 'Database', sections };
};

window.authContextNav = function(activeId) {
  const sections = [
    { heading: 'Manage', items: [
      { id: 'users', label: 'Users', href: 'auth-users.html' },
      { id: 'roles', label: 'Roles & Permissions', href: 'auth-roles.html' },
      { id: 'approval-routing', label: 'Approval Routing', href: 'auth-approval-routing.html' },
      { id: 'sessions', label: 'Sessions', href: 'auth-sessions.html' }
    ]},
    { heading: 'Configure', items: [
      { id: 'identity-providers', label: 'Identity Providers', href: 'auth-identity-providers.html' },
      { id: 'email-templates', label: 'Email Templates', href: 'auth-email-templates.html' },
      { id: 'rate-limits', label: 'Rate Limits', href: 'auth-rate-limits.html' },
      { id: 'auth-policies', label: 'Auth Policies', href: 'auth-policies.html' }
    ]}
  ].map(section => ({
    ...section,
    items: section.items.map(item => ({ ...item, active: item.id === activeId }))
  }));
  return { title: 'Authentication', sections };
};

window.aiPipelineContextNav = function(activeId) {
  const sections = [
    { heading: 'Project', items: [
      { id: 'project-overview', label: 'Current project', icon: '▦', href: 'ai-pipeline-overview.html' }
    ]},
    { heading: 'Pipeline stages', items: [
      { id: 'intent', label: '1. Intent capture', href: 'ai-pipeline-intent.html' },
      { id: 'prd', label: '2. Requirements', href: 'ai-pipeline-prd.html' },
      { id: 'design-tokens', label: '3. Design tokens', href: 'ai-pipeline-design-tokens.html' },
      { id: 'schema-synthesis', label: '4. Schema synthesis', href: 'ai-pipeline-schema-synthesis.html' },
      { id: 'data-migration', label: '5. Data migration', href: 'ai-pipeline-data-migration.html' },
      { id: 'ui-gen', label: '6. UI generation', href: 'ai-pipeline-ui-gen.html' },
      { id: 'code-gen', label: '7. Code generation', href: 'ai-pipeline-code-gen.html' },
      { id: 'test-gen', label: '8. Tests', href: 'ai-pipeline-test-gen.html' },
      { id: 'deployment', label: '9. Deployment', href: 'ai-pipeline-deployment.html' },
      { id: 'maintenance', label: '10. Maintenance', href: 'ai-pipeline-maintenance.html' }
    ]},
    { heading: 'Cross-cutting', items: [
      { id: 'history', label: 'Generation history', href: 'generation-history.html' },
      { id: 'approvals', label: 'Approvals queue', href: 'approvals.html' }
    ]}
  ].map(section => ({
    ...section,
    items: section.items.map(item => ({ ...item, active: item.id === activeId }))
  }));
  return { title: 'AI Pipeline', sections };
};

window.advisorsContextNav = function(activeId) {
  const sections = [
    { heading: 'Overview', items: [
      { id: 'all', label: 'All advisors', href: 'advisors.html' }
    ]},
    { heading: 'Quality', items: [
      { id: 'seo', label: 'SEO', href: 'advisors-seo.html' },
      { id: 'lighthouse', label: 'Lighthouse / Performance', href: 'advisors-lighthouse.html' },
      { id: 'a11y', label: 'Accessibility', href: 'advisors-a11y.html' },
      { id: 'best-practices', label: 'Best Practices', href: 'advisors-best-practices.html' }
    ]},
    { heading: 'Security', items: [
      { id: 'cve', label: 'CVE / Dependencies', href: 'advisors-cve.html' },
      { id: 'pentest', label: 'Pentest / DAST', href: 'advisors-pentest.html' },
      { id: 'sast', label: 'SAST / Static analysis', href: 'advisors-sast.html' }
    ]},
    { heading: 'Database', items: [
      { id: 'db-security', label: 'DB Security', href: 'database-security-advisor.html' },
      { id: 'db-perf', label: 'DB Performance', href: 'database-performance-advisor.html' },
      { id: 'query-perf', label: 'Query Performance', href: 'database-query-performance.html' }
    ]},
    { heading: 'Cost', items: [
      { id: 'cost', label: 'Cost optimisation', href: 'advisors-cost.html' }
    ]}
  ].map(section => ({
    ...section,
    items: section.items.map(item => ({ ...item, active: item.id === activeId }))
  }));
  return { title: 'Advisors', sections };
};

window.apisContextNav = function(activeId) {
  const sections = [
    { heading: 'API surface', items: [
      { id: 'rest', label: 'REST', href: 'apis-rest.html' },
      { id: 'graphql', label: 'GraphQL', href: 'apis-graphql.html' },
      { id: 'sdk', label: 'Client SDKs', href: 'apis-sdk.html' }
    ]},
    { heading: 'Access control', items: [
      { id: 'keys', label: 'API Keys', href: 'apis-keys.html' },
      { id: 'webhooks-out', label: 'Webhooks (outgoing)', href: 'apis-webhooks-outgoing.html' },
      { id: 'webhooks-in', label: 'Webhooks (incoming)', href: 'apis-webhooks-incoming.html' }
    ]}
  ].map(section => ({
    ...section,
    items: section.items.map(item => ({ ...item, active: item.id === activeId }))
  }));
  return { title: 'APIs', sections };
};

window.observabilityContextNav = function(activeId) {
  const sections = [
    { heading: 'Telemetry', items: [
      { id: 'metrics', label: 'Metrics', href: 'metrics.html' },
      { id: 'traces', label: 'Traces', href: 'traces.html' },
      { id: 'logs', label: 'Logs', href: 'logs.html' }
    ]},
    { heading: 'Operations', items: [
      { id: 'alerts', label: 'Alerts', href: 'alerts.html' },
      { id: 'uptime', label: 'Uptime / Status', href: 'uptime.html' }
    ]}
  ].map(section => ({
    ...section,
    items: section.items.map(item => ({ ...item, active: item.id === activeId }))
  }));
  return { title: 'Observability', sections };
};
