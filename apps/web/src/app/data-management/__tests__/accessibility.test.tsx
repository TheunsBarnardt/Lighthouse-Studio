// @vitest-environment jsdom
import { render } from '@testing-library/react';
import axe from 'axe-core';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

// next/navigation stubs
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  useParams: () => ({ schemaSlug: 'test-schema' }),
  useSearchParams: () => new URLSearchParams(),
}));

// next-intl stub
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Zustand designer store — return an empty but valid schema state
vi.mock('@/state/designer-store', () => {
  const schema = {
    id: 'test-id',
    slug: 'test-schema',
    name: 'Test Schema',
    version: 1,
    databaseDriver: 'postgres',
    tables: [],
    metadata: { lastDeployedAt: null },
  };
  const store = (selector: (s: unknown) => unknown) =>
    selector({
      workspaceId: 'ws-1',
      schema,
      deployed: schema,
      isDirty: false,
      isLoading: false,
      error: null,
      selectedView: 'table' as const,
      selectedTable: null,
      validationReport: null,
      migrationPreview: null,
      isDeploying: false,
      isValidating: false,
      isPreviewingMigration: false,
      conflictData: null,
      setWorkspaceId: vi.fn(),
      loadSchema: vi.fn().mockResolvedValue(undefined),
      changeView: vi.fn(),
      updateSchema: vi.fn(),
      save: vi.fn(),
      validate: vi.fn(),
      previewMigration: vi.fn(),
      deploy: vi.fn(),
      rollbackTo: vi.fn(),
      clearError: vi.fn(),
      resolveConflict: vi.fn(),
    });
  store.getState = () => ({});
  return { useDesignerStore: store };
});

// API client stub
vi.mock('@/lib/api-client', () => ({
  schemaApi: {
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    listVersions: vi.fn().mockResolvedValue([]),
    rollback: vi.fn(),
  },
  ApiClientError: class ApiClientError extends Error {},
}));

// useSchemaService hook stub
vi.mock('@/hooks/useSchemaService', () => ({
  useListSchemas: () => ({
    data: { items: [], total: 0 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

// ReactFlow — mock to avoid canvas/WebGL in jsdom
vi.mock('@xyflow/react', () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ReactFlow: () => <div aria-label="Schema diagram" />,
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  BackgroundVariant: { Dots: 'dots' },
  addEdge: vi.fn(),
  applyEdgeChanges: vi.fn((changes: unknown, edges: unknown) => edges),
  applyNodeChanges: vi.fn((changes: unknown, nodes: unknown) => nodes),
}));

// Monaco editor — renders a plain textarea fallback
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (v: string) => void }) => (
    <textarea
      aria-label="JSON schema editor"
      value={value ?? ''}
      onChange={(e) => {
        onChange?.(e.target.value);
      }}
    />
  ),
}));

// Telemetry — no-op in tests
vi.mock('@/lib/telemetry', () => ({
  trackAction: vi.fn(),
  reportError: vi.fn(),
  withSpan: (_name: string, fn: () => unknown) => fn(),
}));

async function axeCheck(importFn: () => Promise<{ default: React.ComponentType }>) {
  const { default: Page } = await importFn();
  const { container } = render(<Page />);
  const results = await axe.run(container);
  return results.violations;
}

describe('Schema designer page accessibility', () => {
  it('schema list page: no critical axe violations', async () => {
    const violations = await axeCheck(() => import('../page'));
    const critical = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toHaveLength(0);
  });

  it('schema editor page: no critical axe violations', async () => {
    const violations = await axeCheck(() => import('../[schemaSlug]/page'));
    const critical = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toHaveLength(0);
  });

  it('api-explorer page: no critical axe violations', async () => {
    const violations = await axeCheck(() => import('../[schemaSlug]/api-explorer/page'));
    const critical = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toHaveLength(0);
  });

  it('history page: no critical axe violations', async () => {
    const violations = await axeCheck(() => import('../[schemaSlug]/history/page'));
    const critical = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toHaveLength(0);
  });
});
