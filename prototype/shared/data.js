/* =========================================================================
   SHARED MOCK DATA
   Used across all pages so they tell a consistent story.
   ========================================================================= */

window.MOCK = {
  workspace: {
    id: 'acme',
    name: 'Acme Corporation',
    database: 'postgres'
  },

  currentProjectId: 'crm-001',

  projects: [
    {
      id: 'crm-001',
      name: 'Internal Sales CRM',
      description: 'Replacing spreadsheet-based deal tracking',
      stage: 'ui-gen',
      status: 'active',
      created: '2026-04-15',
      cost: 23.40,
      stagesComplete: 4
    },
    {
      id: 'blog-001',
      name: 'Marketing Blog',
      description: 'Public marketing site with CMS',
      stage: 'maintenance',
      status: 'live',
      created: '2026-02-08',
      cost: 41.20,
      stagesComplete: 10
    }
  ],

  tables: [
    { name: 'audit_log', rls: 'unrestricted', cols: 7, rows: 22, size: '256 kB' },
    { name: 'cities', rls: 'unrestricted', cols: 4, rows: 0, size: '8 kB' },
    { name: 'contacts', rls: 'unrestricted', cols: 9, rows: 1247, size: '864 kB' },
    { name: 'deals', rls: 'unrestricted', cols: 11, rows: 87, size: '156 kB' },
    { name: 'devices', rls: 'unrestricted', cols: 8, rows: 0, size: '8 kB' },
    { name: 'emergency_services', rls: 'unrestricted', cols: 12, rows: 0, size: '8 kB' },
    { name: 'incident_reports', rls: 'unrestricted', cols: 18, rows: 0, size: '8 kB' },
    { name: 'incidents', rls: 'unrestricted', cols: 10, rows: 0, size: '8 kB' },
    { name: 'live_pins', rls: 'unrestricted', cols: 12, rows: 0, size: '8 kB' },
    { name: 'login_attempts', rls: 'unrestricted', cols: 6, rows: 0, size: '8 kB' },
    { name: 'message_channels', rls: 'unrestricted', cols: 6, rows: 2, size: '16 kB' },
    { name: 'messages', rls: 'unrestricted', cols: 9, rows: 47, size: '64 kB' },
    { name: 'next_of_kin', rls: 'unrestricted', cols: 5, rows: 0, size: '8 kB' },
    { name: 'notification_events', rls: 'unrestricted', cols: 8, rows: 0, size: '8 kB' },
    { name: 'patrol_breadcrumbs', rls: 'unrestricted', cols: 9, rows: 0, size: '8 kB' },
    { name: 'patrol_members', rls: 'unrestricted', cols: 7, rows: 0, size: '8 kB' },
    { name: 'patrol_stops', rls: 'unrestricted', cols: 7, rows: 0, size: '8 kB' },
    { name: 'patrols', rls: 'unrestricted', cols: 21, rows: 0, size: '8 kB' },
    { name: 'push_tokens', rls: 'unrestricted', cols: 5, rows: 0, size: '8 kB' },
    { name: 'tags', rls: 'unrestricted', cols: 3, rows: 14, size: '16 kB' },
    { name: 'users', rls: 'unrestricted', cols: 4, rows: 8, size: '16 kB' }
  ],

  // Sample data for the table editor grid, per table
  tableSchemas: {
    contacts: {
      columns: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'name', type: 'text' },
        { name: 'email', type: 'text' },
        { name: 'company', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'created_at', type: 'timestamptz' }
      ],
      rows: [
        ['c1a2-...-8f7e', 'Alice Schwartz', 'alice@beta.com', 'Beta Co', '+1 415 555 0142', '2026-04-29 14:32'],
        ['c1a3-...-2d4f', 'Bob Rodriguez', 'bob@globex.com', 'Globex Corp', '+1 415 555 0173', '2026-04-28 09:14'],
        ['c1a4-...-9b1c', 'Carla Hayashi', 'carla@initech.com', 'Initech', '+1 415 555 0198', '2026-04-26 16:48'],
        ['c1a5-...-7e3a', 'Dmitri Volkov', 'dmitri@piedpiper.com', 'Pied Piper', '+1 415 555 0211', '2026-04-22 11:02'],
        ['c1a6-...-4f2b', 'Elena Tomescu', 'elena@hooli.com', 'Hooli', '+1 415 555 0234', '2026-04-21 15:30'],
        ['c1a7-...-1d8e', 'Faisal Khan', 'faisal@acme.com', 'Acme Inc', '+1 415 555 0257', '2026-04-15 08:22'],
        ['c1a8-...-6c9a', 'Greta Lindström', 'greta@beta.com', 'Beta Co', '+1 415 555 0280', '2026-04-14 13:55'],
        ['c1a9-...-3b7d', 'Hiro Tanaka', 'hiro@globex.com', 'Globex Corp', '+1 415 555 0303', '2026-04-08 17:42'],
        ['c1aa-...-5e2f', 'Ines Da Silva', 'ines@initech.com', 'Initech', '+1 415 555 0326', '2026-04-07 10:18'],
        ['c1ab-...-8a4c', 'Jakub Nowak', 'jakub@piedpiper.com', 'Pied Piper', '+1 415 555 0349', '2026-04-01 12:00']
      ]
    },
    deals: {
      columns: [
        { name: 'id', type: 'uuid', pk: true },
        { name: 'contact_id', type: 'uuid', fk: true },
        { name: 'title', type: 'text' },
        { name: 'stage', type: 'deal_stage' },
        { name: 'amount', type: 'numeric' },
        { name: 'owner_id', type: 'uuid', fk: true },
        { name: 'created_at', type: 'timestamptz' }
      ],
      rows: [
        ['d101-...-9f2a', 'c1a2-...-8f7e', 'Beta Co Q3 Renewal', 'negotiation', '$87,500.00', 'u01-...-jdk', '2026-04-15 10:30'],
        ['d102-...-3b4c', 'c1a3-...-2d4f', 'Globex Annual License', 'proposal', '$142,000.00', 'u02-...-mrc', '2026-04-12 09:18'],
        ['d103-...-7d2e', 'c1a4-...-9b1c', 'Initech Expansion', 'qualified', '$45,000.00', 'u01-...-jdk', '2026-04-08 14:22'],
        ['d104-...-2f1a', 'c1a5-...-7e3a', 'Pied Piper Pilot', 'lead', '$12,000.00', 'u03-...-pls', '2026-04-05 16:15'],
        ['d105-...-8c3b', 'c1a6-...-4f2b', 'Hooli Q2 Sale', 'won', '$64,200.00', 'u02-...-mrc', '2026-03-28 11:48'],
        ['d106-...-4e9d', 'c1a7-...-1d8e', 'Acme Multi-year', 'negotiation', '$230,000.00', 'u01-...-jdk', '2026-03-20 13:00']
      ]
    },
    audit_log: {
      columns: [
        { name: 'id', type: 'bigint', pk: true },
        { name: 'actor_id', type: 'uuid', fk: true },
        { name: 'action', type: 'text' },
        { name: 'resource', type: 'text' },
        { name: 'occurred_at', type: 'timestamptz' },
        { name: 'hash', type: 'text' }
      ],
      rows: [
        ['1247', 'u01-...-jdk', 'ai.deployment.deployment_initiated', 'production', '2026-05-01 14:32', 'a3f2...8c1d'],
        ['1246', 'u01-...-jdk', 'ai.test_generation.approved', 'test_suite_47', '2026-05-01 14:28', 'b8e1...7f2a'],
        ['1245', 'system', 'ai.test_generation.test_run_completed', 'test_run_127', '2026-05-01 14:20', '4d92...3a1c'],
        ['1244', 'u02-...-mrc', 'ai.code_generation.function_approved', 'updateDealStage', '2026-05-01 14:14', '7c2f...9e8b'],
        ['1243', 'u01-...-jdk', 'ai.ui_generation.component_approved', 'ContactForm', '2026-05-01 14:04', '2a14...5d6e']
      ]
    }
  },

  // Pipeline stages for stepper
  pipelineStages: [
    { key: 'intent', label: 'Intent' },
    { key: 'prd', label: 'PRD' },
    { key: 'design-tokens', label: 'Tokens' },
    { key: 'schema-synthesis', label: 'Schema' },
    { key: 'data-migration', label: 'Migrate' },
    { key: 'ui-gen', label: 'UI' },
    { key: 'code-gen', label: 'Code' },
    { key: 'test-gen', label: 'Tests' },
    { key: 'deployment', label: 'Deploy' },
    { key: 'maintenance', label: 'Maintain' }
  ]
};
