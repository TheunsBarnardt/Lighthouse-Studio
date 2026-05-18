export interface ContextNavItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  badge?: string | number;
}

export interface ContextNavSection {
  heading?: string;
  items: ContextNavItem[];
}

export interface ContextNavConfig {
  title: string;
  sections: ContextNavSection[];
  actionLabel?: string;
  actionHref?: string;
}

export interface ShellConfig {
  mode: string;
  contextNav: ContextNavConfig | null;
}

function workspacesContextNav(slug: string): ContextNavConfig {
  return {
    title: 'Workspaces',
    sections: [
      {
        heading: 'Workspace',
        items: [
          { id: 'overview', label: 'Overview', href: `/workspaces/${slug}` },
          { id: 'members', label: 'Members', href: `/workspaces/${slug}/members` },
          { id: 'roles', label: 'Roles', href: `/workspaces/${slug}/roles` },
          { id: 'invitations', label: 'Invitations', href: `/workspaces/${slug}/invitations` },
        ],
      },
      {
        heading: 'Auth Management',
        items: [
          { id: 'auth-policies', label: 'Policies', href: `/workspaces/${slug}/auth/policies` },
          { id: 'auth-sessions', label: 'Sessions', href: `/workspaces/${slug}/auth/sessions` },
          {
            id: 'auth-providers',
            label: 'Identity Providers',
            href: `/workspaces/${slug}/auth/providers`,
          },
        ],
      },
      {
        heading: 'Branding',
        items: [
          {
            id: 'branding-presets',
            label: 'Presets',
            href: `/workspaces/${slug}/branding/presets`,
          },
          { id: 'branding-tokens', label: 'Tokens', href: `/workspaces/${slug}/branding/tokens` },
          {
            id: 'branding-advanced',
            label: 'Advanced',
            href: `/workspaces/${slug}/branding/advanced`,
          },
          {
            id: 'branding-preview',
            label: 'Preview',
            href: `/workspaces/${slug}/branding/preview`,
          },
        ],
      },
      {
        heading: 'Settings',
        items: [
          {
            id: 'email-templates',
            label: 'Email templates',
            href: `/workspaces/${slug}/email-templates`,
          },
        ],
      },
    ],
  };
}

function blocksContextNav(): ContextNavConfig {
  return {
    title: 'Blocks',
    sections: [
      {
        heading: 'Library',
        items: [{ id: 'all', label: 'All blocks', href: '/blocks' }],
      },
      {
        heading: 'Categories',
        items: [
          { id: 'hero', label: 'Hero', href: '/blocks?category=hero' },
          { id: 'cta', label: 'CTA', href: '/blocks?category=cta' },
          { id: 'features', label: 'Features', href: '/blocks?category=features' },
          { id: 'pricing', label: 'Pricing', href: '/blocks?category=pricing' },
          { id: 'testimonial', label: 'Testimonial', href: '/blocks?category=testimonial' },
          { id: 'stats', label: 'Stats', href: '/blocks?category=stats' },
          { id: 'auth', label: 'Auth', href: '/blocks?category=auth' },
          { id: 'form', label: 'Form', href: '/blocks?category=form' },
          { id: 'header', label: 'Header (Chrome)', href: '/blocks?category=header' },
          { id: 'footer', label: 'Footer (Chrome)', href: '/blocks?category=footer' },
          { id: 'table', label: 'Table', href: '/blocks?category=table' },
          { id: 'dashboard', label: 'Dashboard', href: '/blocks?category=dashboard' },
        ],
      },
    ],
  };
}

function aiPipelineContextNav(_activePath: string): ContextNavConfig {
  return {
    title: 'AI Pipeline',
    sections: [
      {
        heading: 'Project',
        items: [{ id: 'overview', label: 'Current project', icon: '▦', href: '/ai-pipeline' }],
      },
      {
        heading: 'Pipeline stages',
        items: [
          { id: 'intent', label: '1. Intent capture', href: '/ai-pipeline/intent-capture' },
          { id: 'prd', label: '2. Requirements', href: '/ai-pipeline/prd-generation' },
          { id: 'ui-gen', label: '3. UI generation', href: '/ai-pipeline/ui-generation' },
          {
            id: 'schema-synthesis',
            label: '4. Schema synthesis',
            href: '/ai-pipeline/schema-synthesis',
          },
          { id: 'data-migration', label: '5. Data migration', href: '/ai-pipeline/data-migration' },
          { id: 'code-gen', label: '6. Code generation', href: '/ai-pipeline/code-generation' },
          { id: 'test-gen', label: '7. Tests', href: '/ai-pipeline/test-generation' },
          { id: 'deployment', label: '8. Deployment', href: '/ai-pipeline/deployment' },
        ],
      },
      {
        heading: 'Cross-cutting',
        items: [
          { id: 'history', label: 'Generation history', href: '/ai-pipeline/history' },
          { id: 'change-requests', label: 'Change requests', href: '/operations/change-requests' },
        ],
      },
    ],
  };
}

// Tables known in the demo workspace — used by the context nav table list
const DEMO_TABLES = [
  { name: 'contacts', rls: 'off' },
  { name: 'deals', rls: 'off' },
  { name: 'activities', rls: 'off' },
  { name: 'users', rls: 'on' },
  { name: 'tags', rls: 'off' },
  { name: 'contact_tags', rls: 'off' },
  { name: 'audit_log', rls: 'on' },
  { name: 'sessions', rls: 'on' },
] as const;

function dataManagementContextNav(): ContextNavConfig {
  return {
    title: 'Data Management',
    sections: [
      {
        heading: 'Browse',
        items: [{ id: 'sql-editor', label: 'SQL Editor', href: '/data-management/sql-editor' }],
      },
      {
        heading: 'public',
        items: DEMO_TABLES.map((t) => ({
          id: `table-${t.name}`,
          label: t.name,
          href: `/data-management?table=${t.name}`,
          badge: t.rls === 'off' ? 'RLS OFF' : undefined,
        })),
      },
      {
        heading: 'Database',
        items: [
          { id: 'tables', label: 'Tables', href: '/data-management/tables' },
          { id: 'migrations', label: 'Migrations', href: '/data-management/migrations' },
          { id: 'functions', label: 'Functions', href: '/data-management/functions' },
          { id: 'triggers', label: 'Triggers', href: '/data-management/triggers' },
          { id: 'indexes', label: 'Indexes', href: '/data-management/indexes' },
          { id: 'extensions', label: 'Extensions', href: '/data-management/extensions' },
          { id: 'roles', label: 'Roles', href: '/data-management/roles' },
          { id: 'policies', label: 'Policies', href: '/data-management/policies' },
        ],
      },
      {
        heading: 'Advanced',
        items: [
          { id: 'publications', label: 'Publications', href: '/data-management/publications' },
          {
            id: 'enumerated-types',
            label: 'Enumerated types',
            href: '/data-management/enumerated-types',
          },
          { id: 'wrappers', label: 'Wrappers', href: '/data-management/wrappers' },
          { id: 'webhooks', label: 'Database webhooks', href: '/data-management/webhooks' },
          {
            id: 'schema-visualizer',
            label: 'Schema visualizer',
            href: '/data-management/schema-visualizer',
          },
          { id: 'backups', label: 'Backups', href: '/backups' },
        ],
      },
      {
        heading: 'Advisors',
        items: [
          { id: 'security-advisor', label: 'Security advisor', href: '/advisors/db-security' },
          {
            id: 'performance-advisor',
            label: 'Performance advisor',
            href: '/advisors/db-performance',
          },
          {
            id: 'query-performance',
            label: 'Query performance',
            href: '/advisors/query-performance',
          },
        ],
      },
    ],
  };
}

function apisContextNav(): ContextNavConfig {
  return {
    title: 'APIs',
    sections: [
      {
        heading: 'Auto-generated',
        items: [
          { id: 'rest', label: 'REST API', href: '/apis/rest' },
          { id: 'graphql', label: 'GraphQL', href: '/apis/graphql' },
          { id: 'sdk', label: 'Client SDK', href: '/apis/sdk' },
        ],
      },
      {
        heading: 'Security',
        items: [{ id: 'keys', label: 'API Keys', href: '/apis/keys' }],
      },
      {
        heading: 'Events',
        items: [
          { id: 'webhooks-outgoing', label: 'Webhooks · Outgoing', href: '/apis/webhooks' },
          {
            id: 'webhooks-incoming',
            label: 'Webhooks · Incoming',
            href: '/apis/webhooks/incoming',
          },
        ],
      },
    ],
  };
}

function approvalsContextNav(): ContextNavConfig {
  return {
    title: 'Approvals',
    sections: [
      {
        heading: 'Queue',
        items: [
          { id: 'pending', label: 'Pending', href: '/approvals', badge: 4 },
          { id: 'mine', label: 'Awaiting me', href: '/approvals/mine', badge: 2 },
          { id: 'requested', label: 'Requested by me', href: '/approvals/requested' },
        ],
      },
      {
        heading: 'History',
        items: [
          { id: 'approved', label: 'Approved', href: '/approvals/approved' },
          { id: 'rejected', label: 'Rejected', href: '/approvals/rejected' },
        ],
      },
      {
        heading: 'Configure',
        items: [{ id: 'routing', label: 'Approval routing', href: '/settings/approval-routing' }],
      },
    ],
  };
}

function edgeFunctionsContextNav(): ContextNavConfig {
  return {
    title: 'Edge Functions',
    sections: [
      {
        heading: 'Functions',
        items: [{ id: 'all', label: 'All functions', href: '/edge-functions' }],
      },
      {
        heading: 'Configure',
        items: [
          { id: 'secrets', label: 'Secrets', href: '/edge-functions/secrets' },
          { id: 'schedules', label: 'Schedules', href: '/edge-functions/schedules' },
        ],
      },
    ],
  };
}

function realtimeContextNav(): ContextNavConfig {
  return {
    title: 'Realtime',
    sections: [
      {
        heading: 'Inspect',
        items: [
          { id: 'overview', label: 'Overview', href: '/realtime' },
          { id: 'channels', label: 'Channels', href: '/realtime/channels' },
          { id: 'connections', label: 'Connections', href: '/realtime/connections' },
          { id: 'presence', label: 'Presence', href: '/realtime/presence' },
        ],
      },
      {
        heading: 'Configure',
        items: [
          { id: 'publications', label: 'Publications', href: '/data-management/publications' },
          { id: 'limits', label: 'Limits', href: '/realtime/limits' },
        ],
      },
    ],
  };
}

function advisorsContextNav(): ContextNavConfig {
  return {
    title: 'Advisors',
    sections: [
      {
        heading: 'Overview',
        items: [{ id: 'all', label: 'All advisors', href: '/advisors' }],
      },
      {
        heading: 'Quality',
        items: [
          { id: 'seo', label: 'SEO', href: '/advisors/seo' },
          { id: 'lighthouse', label: 'Lighthouse / Performance', href: '/advisors/lighthouse' },
          { id: 'a11y', label: 'Accessibility', href: '/advisors/a11y' },
          { id: 'best-practices', label: 'Best Practices', href: '/advisors/best-practices' },
        ],
      },
      {
        heading: 'Security',
        items: [
          { id: 'cve', label: 'CVE / Dependencies', href: '/advisors/cve' },
          { id: 'pentest', label: 'Pentest / DAST', href: '/advisors/pentest' },
          { id: 'sast', label: 'SAST / Static analysis', href: '/advisors/sast' },
          { id: 'db-security', label: 'DB Security', href: '/advisors/db-security' },
          { id: 'db-performance', label: 'DB Performance', href: '/advisors/db-performance' },
          {
            id: 'query-performance',
            label: 'Query Performance',
            href: '/advisors/query-performance',
          },
        ],
      },
      {
        heading: 'Cost',
        items: [{ id: 'cost', label: 'Cost optimisation', href: '/advisors/cost' }],
      },
    ],
  };
}

function observabilityContextNav(): ContextNavConfig {
  return {
    title: 'Observability',
    sections: [
      {
        heading: 'Streams',
        items: [
          { id: 'metrics', label: 'Metrics', href: '/metrics' },
          { id: 'logs', label: 'Logs', href: '/logs' },
          { id: 'traces', label: 'Traces', href: '/traces' },
        ],
      },
      {
        heading: 'Continuous',
        items: [
          { id: 'signals', label: 'Signals', href: '/observability/signals' },
          { id: 'outcomes', label: 'Outcome tracking', href: '/observability/outcomes' },
        ],
      },
      {
        heading: 'Alerts',
        items: [
          { id: 'alerts', label: 'Alerts', href: '/alerts' },
          { id: 'uptime', label: 'Uptime / Status', href: '/uptime' },
        ],
      },
    ],
  };
}

function operationsContextNav(): ContextNavConfig {
  return {
    title: 'Operations',
    sections: [
      {
        heading: 'Change management',
        items: [
          {
            id: 'change-requests',
            label: 'Change requests',
            href: '/operations/change-requests',
          },
        ],
      },
    ],
  };
}

function backupsContextNav(): ContextNavConfig {
  return {
    title: 'Backups',
    sections: [
      {
        heading: 'Backup',
        items: [
          { id: 'snapshots', label: 'Snapshots', href: '/backups' },
          { id: 'pitr', label: 'Point-in-time recovery', href: '/backups/pitr' },
          { id: 'storage', label: 'Storage backups', href: '/backups/storage' },
        ],
      },
      {
        heading: 'Restore',
        items: [{ id: 'history', label: 'Restore history', href: '/backups/history' }],
      },
    ],
  };
}

function settingsContextNav(): ContextNavConfig {
  return {
    title: 'Settings',
    sections: [
      {
        heading: 'Workspace',
        items: [
          { id: 'general', label: 'General', href: '/settings' },
          { id: 'database', label: 'Database', href: '/settings/database' },
          { id: 'ai-budget', label: 'AI Token Budget', href: '/settings/ai-budget' },
          { id: 'approval-routing', label: 'Approval Routing', href: '/settings/approval-routing' },
        ],
      },
      {
        heading: 'Billing',
        items: [
          { id: 'plan', label: 'Plan', href: '/settings/plan' },
          { id: 'invoices', label: 'Invoices', href: '/settings/invoices' },
        ],
      },
      {
        heading: 'Compliance',
        items: [
          { id: 'compliance', label: 'Compliance', href: '/settings/compliance' },
          { id: 'residency', label: 'Data Residency', href: '/settings/residency' },
        ],
      },
    ],
  };
}

function accountContextNav(): ContextNavConfig {
  return {
    title: 'Account',
    sections: [
      {
        heading: 'Profile',
        items: [
          { id: 'profile', label: 'Profile', href: '/account/profile' },
          { id: 'email', label: 'Email', href: '/account/email' },
          { id: 'password', label: 'Password', href: '/account/password' },
          { id: 'mfa', label: 'Two-factor auth', href: '/account/mfa' },
        ],
      },
      {
        heading: 'Security',
        items: [
          { id: 'sessions', label: 'Active sessions', href: '/account/sessions' },
          { id: 'identities', label: 'Linked accounts', href: '/account/identities' },
        ],
      },
      {
        heading: 'Preferences',
        items: [
          { id: 'preferences', label: 'Preferences', href: '/account/preferences' },
          { id: 'danger-zone', label: 'Danger zone', href: '/account/danger-zone' },
        ],
      },
    ],
  };
}

function adminContextNav(): ContextNavConfig {
  return {
    title: 'Admin',
    sections: [
      {
        heading: 'Platform',
        items: [
          { id: 'users', label: 'Users', href: '/admin/users' },
          { id: 'workspaces', label: 'Workspaces', href: '/admin/workspaces' },
          { id: 'audit', label: 'Audit log', href: '/admin/audit' },
          { id: 'upgrade', label: 'Upgrade', href: '/admin/upgrade' },
        ],
      },
    ],
  };
}

function schemaDesignerContextNav(): ContextNavConfig {
  return {
    title: 'Schema Designer',
    sections: [
      {
        heading: 'Design',
        items: [{ id: 'designer', label: 'Visual designer', href: '/schema-designer' }],
      },
    ],
  };
}

function storageContextNav(): ContextNavConfig {
  return {
    title: 'Storage',
    sections: [
      {
        heading: 'Files',
        items: [{ id: 'browser', label: 'File browser', href: '/storage' }],
      },
    ],
  };
}

export function getShellConfig(pathname: string): ShellConfig {
  if (pathname === '/') {
    return { mode: 'home', contextNav: null };
  }

  if (pathname.startsWith('/ai-pipeline')) {
    return { mode: 'ai-pipeline', contextNav: aiPipelineContextNav(pathname) };
  }

  if (pathname.startsWith('/blocks')) {
    return { mode: 'blocks', contextNav: blocksContextNav() };
  }

  if (pathname.startsWith('/approvals')) {
    return { mode: 'approvals', contextNav: approvalsContextNav() };
  }

  if (pathname.startsWith('/data-management')) {
    return { mode: 'table-editor', contextNav: dataManagementContextNav() };
  }

  if (pathname.startsWith('/schema-designer')) {
    return { mode: 'designer', contextNav: schemaDesignerContextNav() };
  }

  if (pathname.startsWith('/storage')) {
    return { mode: 'storage', contextNav: storageContextNav() };
  }

  if (pathname.startsWith('/edge-functions')) {
    return { mode: 'edge-functions', contextNav: edgeFunctionsContextNav() };
  }

  if (pathname.startsWith('/realtime')) {
    return { mode: 'realtime', contextNav: realtimeContextNav() };
  }

  if (pathname.startsWith('/apis')) {
    return { mode: 'apis', contextNav: apisContextNav() };
  }

  if (
    pathname.startsWith('/logs') ||
    pathname.startsWith('/metrics') ||
    pathname.startsWith('/traces') ||
    pathname.startsWith('/alerts') ||
    pathname.startsWith('/uptime') ||
    pathname.startsWith('/observability')
  ) {
    return { mode: 'observability', contextNav: observabilityContextNav() };
  }

  if (pathname.startsWith('/operations')) {
    return { mode: 'operations', contextNav: operationsContextNav() };
  }

  if (pathname.startsWith('/advisors')) {
    return { mode: 'advisors', contextNav: advisorsContextNav() };
  }

  if (pathname.startsWith('/cost')) {
    return { mode: 'cost', contextNav: null };
  }

  if (pathname.startsWith('/integrations')) {
    return { mode: 'integrations', contextNav: null };
  }

  if (pathname.startsWith('/backups')) {
    return { mode: 'backups', contextNav: backupsContextNav() };
  }

  if (pathname.startsWith('/settings')) {
    return { mode: 'settings-workspace', contextNav: settingsContextNav() };
  }

  if (pathname.startsWith('/workspaces')) {
    const slug = pathname.split('/')[2] ?? 'default';
    return { mode: 'settings', contextNav: workspacesContextNav(slug) };
  }

  if (pathname.startsWith('/account')) {
    return { mode: 'settings', contextNav: accountContextNav() };
  }

  if (pathname.startsWith('/admin')) {
    return { mode: 'settings', contextNav: adminContextNav() };
  }

  return { mode: 'home', contextNav: null };
}
