/* =========================================================================
   SHELL JS
   Each page calls Shell.render({ mode, contextNav, dataPlane }) which:
   - Wraps content in the .app grid
   - Renders topbar
   - Renders icon nav (with current mode highlighted)
   - Renders the second-pane context nav (or hides it)
   - Applies .data-plane-shell class to body when on data-plane surfaces
   ========================================================================= */

const Shell = (() => {

  /* Theme management */
  function getTheme() {
    return localStorage.getItem('platform-theme') || 'light';
  }
  function setTheme(theme) {
    localStorage.setItem('platform-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }
  function toggleTheme() {
    setTheme(getTheme() === 'light' ? 'dark' : 'light');
  }

  /* Icon nav structure */
  const ICON_NAV = [
    { id: 'home', icon: '⌂', tooltip: 'Home', href: '../index.html' },
    { id: 'ai-pipeline', icon: '✦', tooltip: 'AI Pipeline', href: 'ai-pipeline-overview.html' },
    { id: 'approvals', icon: '✓', tooltip: 'Approvals', href: 'approvals.html', dot: true },
    { divider: true },
    { id: 'table-editor', icon: '▦', tooltip: 'Table Editor', href: 'table-editor.html' },
    { id: 'sql-editor', icon: '▶_', tooltip: 'SQL Editor', href: 'sql-editor.html' },
    { id: 'designer', icon: '◰', tooltip: 'Page Designer', href: 'designer.html' },
    { id: 'app-chrome', icon: '◱', tooltip: 'App Chrome', href: 'app-chrome.html' },
    { id: 'blocks', icon: '▤', tooltip: 'Blocks Library', href: 'blocks-library.html' },
    { id: 'database', icon: '◷', tooltip: 'Database', href: 'database-schema-visualizer.html' },
    { id: 'auth', icon: '◯', tooltip: 'Authentication', href: 'auth-users.html' },
    { id: 'storage', icon: '⊞', tooltip: 'Storage', href: 'storage.html' },
    { id: 'edge-functions', icon: '⌥', tooltip: 'Edge Functions', href: 'edge-functions.html' },
    { id: 'realtime', icon: '⟳', tooltip: 'Realtime', href: 'realtime.html' },
    { id: 'apis', icon: '⊟', tooltip: 'APIs (REST/GraphQL)', href: 'apis-rest.html' },
    { divider: true },
    { id: 'assets', icon: '◈', tooltip: 'Workspace Assets', href: 'assets.html' },
    { id: 'project-docs', icon: '⎙', tooltip: 'Project Documentation', href: 'project-docs.html' },
    { id: 'advisors', icon: '◐', tooltip: 'Advisors', href: 'advisors.html', dot: true },
    { id: 'observability', icon: '◉', tooltip: 'Observability', href: 'metrics.html' },
    { id: 'logs', icon: '≡', tooltip: 'Logs', href: 'logs.html' },
    { id: 'cost', icon: '$', tooltip: 'Cost & Usage', href: 'cost-dashboard.html' },
    { id: 'integrations', icon: '◇', tooltip: 'Integrations', href: 'integrations.html' },
    { spacer: true },
    { id: 'docs', icon: '?', tooltip: 'Help & Docs', href: 'docs.html' },
    { id: 'settings', icon: '⚙', tooltip: 'Settings', href: 'settings.html' }
  ];

  function renderTopbar(opts = {}) {
    const projectName = opts.projectName || (window.MOCK?.workspace?.name + ' · ' + (window.MOCK?.projects?.find(p => p.id === window.MOCK.currentProjectId)?.name || 'Project'));
    return `
      <div class="topbar">
        <div class="topbar-logo">
          <span class="logo-mark">P</span>
          <span>${projectName}</span>
        </div>
        <button class="topbar-connect-btn" onclick="Shell.toast('Connection details would open', 'info')">
          <span style="font-size: 9px;">⚏</span>
          <span>Connect</span>
        </button>
        <div class="topbar-spacer"></div>
        <span class="topbar-update-badge">UPDATE AVAILABLE</span>
        <button class="topbar-search" onclick="Shell.openCmdk()">
          <span>Search...</span>
          <span class="kbd" style="margin-left: auto;">⌘K</span>
        </button>
        <div class="topbar-actions">
          <button class="icon-btn" onclick="Shell.toggleTheme()" title="Toggle theme">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M8 1v2M8 13v2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M1 8h2M13 8h2M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4"/>
              <circle cx="8" cy="8" r="3"/>
            </svg>
          </button>
          <button class="icon-btn" title="Notifications">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 6.5a5 5 0 0 1 10 0V10l1 2H2l1-2V6.5zM6 13a2 2 0 0 0 4 0"/>
            </svg>
          </button>
          <button class="icon-btn" title="User">
            <div class="avatar" style="width: 22px; height: 22px; font-size: 10px;">JD</div>
          </button>
        </div>
      </div>
    `;
  }

  function renderIconNav(activeMode) {
    return `
      <div class="iconnav">
        ${ICON_NAV.map(item => {
          if (item.divider) return '<div class="iconnav-divider"></div>';
          if (item.spacer) return '<div class="iconnav-spacer"></div>';
          const active = item.id === activeMode ? 'active' : '';
          const dotClass = item.dot ? 'has-dot' : '';
          return `<a href="${item.href}" class="iconnav-item ${active} ${dotClass}" title="${item.tooltip}">${item.icon}</a>`;
        }).join('')}
      </div>
    `;
  }

  function renderContextNav(contextNav) {
    if (!contextNav) return '';
    if (contextNav.html) {
      // Custom HTML for special nav (Table Editor, SQL Editor)
      return `<div class="contextnav">${contextNav.html}</div>`;
    }
    const sections = (contextNav.sections || []).map(section => `
      <div class="contextnav-section">
        ${section.heading ? `<div class="contextnav-heading">${section.heading}</div>` : ''}
        ${section.items.map(item => `
          <a href="${item.href || '#'}" class="contextnav-item ${item.active ? 'active' : ''}">
            ${item.icon ? `<span class="icon">${item.icon}</span>` : ''}
            <span style="flex:1;">${item.label}</span>
            ${item.badge ? `<span class="badge badge-danger" style="font-size:9px;">${item.badge}</span>` : ''}
          </a>
        `).join('')}
      </div>
    `).join('');
    return `
      <div class="contextnav">
        <div class="contextnav-header">
          <div class="contextnav-title">${contextNav.title}</div>
        </div>
        <div class="contextnav-content">
          ${sections}
        </div>
      </div>
    `;
  }

  /**
   * Render the full app shell into a target element.
   * Pages call this once with their config, then write content into #main-content.
   *
   * opts:
   *  - mode: 'home' | 'ai-pipeline' | 'table-editor' | ... (drives icon nav highlight)
   *  - contextNav: { title, sections: [...] } | { html } | null
   *  - dataPlane: bool — apply .data-plane-shell to <body> for Supabase-style chrome
   *  - projectName: optional override for topbar text
   *  - mainContent: HTML for the main pane (or write directly into #main-content after)
   */
  function render(opts = {}) {
    setTheme(getTheme());
    if (opts.dataPlane) {
      document.body.classList.add('data-plane-shell');
    } else {
      document.body.classList.remove('data-plane-shell');
    }
    const target = document.getElementById('app-root') || document.body;
    target.innerHTML = `
      <div class="app${opts.contextNav ? '' : ' context-collapsed'}">
        ${renderTopbar({ projectName: opts.projectName })}
        ${renderIconNav(opts.mode)}
        ${renderContextNav(opts.contextNav)}
        <div class="main" id="main-content">${opts.mainContent || ''}</div>
      </div>
      <div class="toast-container" id="toasts"></div>
      <div class="cmdk-overlay hidden" id="cmdk" onclick="if(event.target.id==='cmdk') Shell.closeCmdk()">
        <div class="cmdk">
          <input type="text" class="cmdk-input" placeholder="Type a command or search..." id="cmdk-input" oninput="Shell.filterCmdk(this.value)" />
          <div class="cmdk-results" id="cmdk-results"></div>
        </div>
      </div>
    `;

    // Bind ⌘K
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openCmdk(); }
      if (e.key === 'Escape') closeCmdk();
    });
  }

  /* TOAST */
  function toast(msg, type = 'info', title = null) {
    const container = document.getElementById('toasts');
    if (!container) return;
    const div = document.createElement('div');
    div.className = `toast ${type}`;
    div.innerHTML = `${title ? `<div class="toast-title">${title}</div>` : ''}<div class="toast-msg">${msg}</div>`;
    container.appendChild(div);
    setTimeout(() => {
      div.style.animation = 'slideInRight 200ms reverse';
      setTimeout(() => div.remove(), 200);
    }, 3500);
  }

  /* COMMAND PALETTE */
  const cmdkItems = [
    { group: 'Navigation', label: 'Home', href: '../index.html' },
    { group: 'Designer', label: 'Page Designer', href: 'designer.html' },
    { group: 'Designer', label: 'Blocks Library', href: 'blocks-library.html' },
    { group: 'AI Pipeline', label: 'Project overview', href: 'ai-pipeline-overview.html' },
    { group: 'AI Pipeline', label: 'Stage 1 · Intent', href: 'ai-pipeline-intent.html' },
    { group: 'AI Pipeline', label: 'Stage 2 · PRD', href: 'ai-pipeline-prd.html' },
    { group: 'AI Pipeline', label: 'Stage 3 · Design tokens', href: 'ai-pipeline-design-tokens.html' },
    { group: 'AI Pipeline', label: 'Stage 4 · Schema synthesis', href: 'ai-pipeline-schema-synthesis.html' },
    { group: 'AI Pipeline', label: 'Stage 6 · UI generation', href: 'ai-pipeline-ui-gen.html' },
    { group: 'AI Pipeline', label: 'Stage 7 · Code generation', href: 'ai-pipeline-code-gen.html' },
    { group: 'AI Pipeline', label: 'Stage 8 · Tests', href: 'ai-pipeline-test-gen.html' },
    { group: 'AI Pipeline', label: 'Stage 9 · Deployment', href: 'ai-pipeline-deployment.html' },
    { group: 'AI Pipeline', label: 'Stage 10 · Maintenance', href: 'ai-pipeline-maintenance.html' },
    { group: 'Data plane', label: 'Table Editor', href: 'table-editor.html' },
    { group: 'Data plane', label: 'SQL Editor', href: 'sql-editor.html' },
    { group: 'Data plane', label: 'Database · Schema Visualizer', href: 'database-schema-visualizer.html' },
    { group: 'Data plane', label: 'Database · Tables', href: 'database-tables.html' },
    { group: 'Data plane', label: 'Database · Functions', href: 'database-functions.html' },
    { group: 'Data plane', label: 'Database · Indexes', href: 'database-indexes.html' },
    { group: 'Data plane', label: 'Database · Triggers', href: 'database-triggers.html' },
    { group: 'Data plane', label: 'Database · Extensions', href: 'database-extensions.html' },
    { group: 'Data plane', label: 'Database · Roles', href: 'database-roles.html' },
    { group: 'Data plane', label: 'Database · Migrations', href: 'database-migrations.html' },
    { group: 'Data plane', label: 'Auth · Users', href: 'auth-users.html' },
    { group: 'Data plane', label: 'Auth · Roles', href: 'auth-roles.html' },
    { group: 'Data plane', label: 'Auth · Approval routing', href: 'auth-approval-routing.html' },
    { group: 'Data plane', label: 'Auth · Identity providers', href: 'auth-identity-providers.html' },
    { group: 'Data plane', label: 'Storage', href: 'storage.html' },
    { group: 'Data plane', label: 'Edge Functions', href: 'edge-functions.html' },
    { group: 'Data plane', label: 'Realtime', href: 'realtime.html' },
    { group: 'Data plane', label: 'Advisors', href: 'advisors.html' },
    { group: 'Data plane', label: 'Logs', href: 'logs.html' },
    { group: 'Data plane', label: 'Integrations', href: 'integrations.html' },
    { group: 'Settings', label: 'Settings · General', href: 'settings.html' },
    { group: 'Actions', label: 'Toggle theme', cmd: toggleTheme }
  ];

  function openCmdk() {
    const el = document.getElementById('cmdk');
    if (!el) return;
    el.classList.remove('hidden');
    const input = document.getElementById('cmdk-input');
    input.value = '';
    input.focus();
    filterCmdk('');
  }
  function closeCmdk() {
    const el = document.getElementById('cmdk');
    if (el) el.classList.add('hidden');
  }
  function filterCmdk(q) {
    q = q.toLowerCase();
    const filtered = cmdkItems.filter(i => i.label.toLowerCase().includes(q));
    const grouped = {};
    filtered.forEach(i => { (grouped[i.group] = grouped[i.group] || []).push(i); });
    const html = Object.entries(grouped).map(([g, items]) => `
      <div class="cmdk-group-heading">${g}</div>
      ${items.map(i => i.href
        ? `<a class="cmdk-item" href="${i.href}" style="text-decoration: none; color: inherit;">${i.label}</a>`
        : `<div class="cmdk-item" onclick="(${i.cmd.toString()})()">${i.label}</div>`
      ).join('')}
    `).join('');
    document.getElementById('cmdk-results').innerHTML = html
      || '<div style="padding: 16px; color: var(--fg-tertiary); font-size: 13px;">No results</div>';
  }

  /* HELPERS for use in main content */
  function statusBadge(status) {
    const map = {
      pending: { cls: 'badge-default', label: 'Pending' },
      in_progress: { cls: 'badge-info', label: 'In Progress' },
      in_review: { cls: 'badge-warning', label: 'In Review' },
      approved: { cls: 'badge-success', label: 'Approved' },
      active: { cls: 'badge-info', label: 'Live' },
      failed: { cls: 'badge-danger', label: 'Failed' },
      live: { cls: 'badge-success', label: 'Live' },
      applied: { cls: 'badge-success', label: 'Applied' }
    };
    const s = map[status] || map.pending;
    return `<span class="badge ${s.cls}">${s.label}</span>`;
  }

  function pipelineStepper(activeStage) {
    const stages = window.MOCK.pipelineStages;
    const activeIdx = stages.findIndex(s => s.key === activeStage);
    return `<div class="pipeline-stepper">${stages.map((s, i) => {
      const isActive = i === activeIdx;
      const isComplete = i < activeIdx;
      return `${i > 0 ? '<span class="arrow">›</span>' : ''}<a href="ai-pipeline-${s.key}.html" class="pipeline-step ${isActive ? 'active' : ''} ${isComplete ? 'complete' : ''}"><span class="dot"></span><span>${s.label}</span></a>`;
    }).join('')}</div>`;
  }

  return {
    render, toggleTheme, setTheme, getTheme,
    toast,
    openCmdk, closeCmdk, filterCmdk,
    statusBadge, pipelineStepper
  };
})();
