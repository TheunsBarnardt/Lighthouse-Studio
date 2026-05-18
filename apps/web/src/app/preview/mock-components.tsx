/**
 * Mock preview components used by the `/preview/[artifactId]` iframe target.
 *
 * Each interactive element carries a stable `data-edit-id` so the selection
 * agent (`selection-agent.tsx`) can identify what the user clicked, and the
 * edit-overlay system (`@/lib/visual-edits/edit-overlay`) can address mutations.
 *
 * Naming convention: `<ComponentName>.<role>` or `<ComponentName>.<tag>[<n>]`.
 *
 * When real artifact generation lands (Objective 26 §6.6), these IDs are
 * replaced by `data-loc="<path>:<line>:<col>"` emitted by a Babel plugin.
 */

import type { JSX } from 'react';

export const MOCK_ARTIFACT_IDS = [
  'ContactsListPage',
  'ContactDetailPage',
  'Dashboard',
  'SignInPage',
  'AppShell',
] as const;

export type MockArtifactId = (typeof MOCK_ARTIFACT_IDS)[number];

export function isMockArtifactId(id: string): id is MockArtifactId {
  return (MOCK_ARTIFACT_IDS as readonly string[]).includes(id);
}

interface MockComponentProps {
  artifactId: MockArtifactId;
}

export function MockComponent({ artifactId }: MockComponentProps): JSX.Element {
  switch (artifactId) {
    case 'ContactsListPage':
      return <MockListPreview entityName="Contacts" />;
    case 'ContactDetailPage':
      return <MockDetailPreview entityName="Contact" />;
    case 'Dashboard':
      return <MockDashboardPreview />;
    case 'SignInPage':
      return <MockAuthPreview title="Sign In" />;
    case 'AppShell':
      return <MockShellPreview />;
  }
}

function MockListPreview({ entityName }: { entityName: string }) {
  return (
    <div data-edit-id="MockListPreview.root">
      <div className="flex items-center justify-between mb-3" data-edit-id="MockListPreview.header">
        <h1
          className="text-base font-semibold text-zinc-900 dark:text-white"
          data-edit-id="MockListPreview.title"
        >
          {entityName}
        </h1>
        <button
          type="button"
          className="px-3 py-1 bg-blue-600 text-white text-xs rounded"
          data-edit-id="MockListPreview.newBtn"
        >
          New {entityName.slice(0, -1)}
        </button>
      </div>
      <table className="w-full text-xs border-collapse" data-edit-id="MockListPreview.table">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="text-left py-1.5 text-zinc-500 font-medium">Name</th>
            <th className="text-left py-1.5 text-zinc-500 font-medium">Email</th>
            <th className="text-left py-1.5 text-zinc-500 font-medium">Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={4} className="py-4 text-center text-xs text-zinc-400">
              No records yet.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function MockDetailPreview({ entityName }: { entityName: string }) {
  return (
    <div data-edit-id="MockDetailPreview.root">
      <div className="flex items-center gap-2 mb-3" data-edit-id="MockDetailPreview.breadcrumb">
        <span className="text-xs text-zinc-500 cursor-pointer">← Back</span>
        <span className="text-xs text-zinc-400">/</span>
        <h1
          className="text-base font-semibold text-zinc-900 dark:text-white"
          data-edit-id="MockDetailPreview.title"
        >
          {entityName} Detail
        </h1>
      </div>
      <div className="space-y-2" data-edit-id="MockDetailPreview.fields">
        {['Name', 'Email', 'Created At'].map((field) => (
          <div key={field} className="flex gap-2 text-xs">
            <span className="w-20 text-zinc-500 flex-shrink-0">{field}</span>
            <span className="text-zinc-900 dark:text-white">Sample value</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockDashboardPreview() {
  return (
    <div data-edit-id="MockDashboardPreview.root">
      <h1
        className="text-base font-semibold text-zinc-900 dark:text-white mb-3"
        data-edit-id="MockDashboardPreview.title"
      >
        Dashboard
      </h1>
      <div className="grid grid-cols-2 gap-2 mb-4" data-edit-id="MockDashboardPreview.stats">
        {[
          ['Contacts', '—'],
          ['Deals', '—'],
        ].map(([label, val]) => (
          <div
            key={label}
            className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3"
            data-edit-id={`MockDashboardPreview.stat.${String(label)}`}
          >
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="text-xl font-semibold text-zinc-900 dark:text-white">{val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockAuthPreview({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center min-h-40" data-edit-id="MockAuthPreview.root">
      <div
        className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-6 w-64 space-y-3"
        data-edit-id="MockAuthPreview.card"
      >
        <h2
          className="text-sm font-semibold text-zinc-900 dark:text-white text-center"
          data-edit-id="MockAuthPreview.title"
        >
          {title}
        </h2>
        <input
          className="w-full border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1.5 text-xs"
          placeholder="Email"
          data-edit-id="MockAuthPreview.emailInput"
        />
        <input
          type="password"
          className="w-full border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1.5 text-xs"
          placeholder="Password"
          data-edit-id="MockAuthPreview.passwordInput"
        />
        <button
          type="button"
          className="w-full py-1.5 bg-blue-600 text-white text-xs rounded"
          data-edit-id="MockAuthPreview.submit"
        >
          {title}
        </button>
      </div>
    </div>
  );
}

function MockShellPreview() {
  return (
    <div className="flex h-40" data-edit-id="MockShellPreview.root">
      <div
        className="w-32 bg-zinc-900 dark:bg-zinc-950 flex-shrink-0 p-2 space-y-1"
        data-edit-id="MockShellPreview.sidebar"
      >
        {['Dashboard', 'Contacts', 'Deals', 'Settings'].map((item) => (
          <div
            key={item}
            className={`px-2 py-1 text-xs rounded cursor-pointer ${
              item === 'Contacts' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
            }`}
            data-edit-id={`MockShellPreview.nav.${item}`}
          >
            {item}
          </div>
        ))}
      </div>
      <div className="flex-1 bg-zinc-50 dark:bg-zinc-900 p-3" data-edit-id="MockShellPreview.main">
        <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded mb-2" />
        <div className="h-2 w-48 bg-zinc-200 dark:bg-zinc-800 rounded" />
      </div>
    </div>
  );
}
