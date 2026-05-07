// @vitest-environment jsdom
import { render } from '@testing-library/react';
import axe from 'axe-core';
import React from 'react';
import { describe, expect, it, vi, beforeAll } from 'vitest';

import type { ColumnDefinition, RowContext } from '../types.js';

// next/navigation stubs
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  useParams: () => ({ schemaSlug: 'test-schema' }),
  useSearchParams: () => new URLSearchParams(),
}));

// auth context stub
vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Tester', email: 'test@example.com' },
    refresh: vi.fn(),
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// @tanstack/react-virtual — avoid layout measurement in jsdom
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    measureElement: vi.fn(),
  }),
}));

// Stub global fetch — tables list returns empty; all others return empty data.
beforeAll(() => {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    const body =
      typeof url === 'string' && url.includes('/tables')
        ? JSON.stringify({ items: [] })
        : JSON.stringify({ rows: [], columns: [], total: 0 });
    return Promise.resolve(
      new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
  });
});

const mockColumnDef: ColumnDefinition = {
  id: 'col-1',
  name: 'name',
  type: 'text',
  required: false,
  nullable: true,
  isPrimaryKey: false,
  isPii: false,
};

const mockRowContext: RowContext = {
  id: 'row-1',
  version: 1,
  permissions: { canEdit: true, canDelete: true, redactedFields: new Set<string>() },
  isEditingLocally: false,
  hasPendingRealtime: false,
};

async function axeCheck(importFn: () => Promise<{ default: React.ComponentType }>) {
  const { default: Page } = await importFn();
  const { container } = render(<Page />);
  const results = await axe.run(container);
  return results.violations;
}

describe('Data browser page accessibility', () => {
  it('empty state (no table selected): no critical axe violations', async () => {
    const violations = await axeCheck(() => import('../page'));
    const critical = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toHaveLength(0);
  });
});

// ── Cell component accessibility ─────────────────────────────────────────────

describe('Data browser cell accessibility', () => {
  const cellProps = {
    isEditing: false,
    canEdit: true,
    isRedacted: false,
    onStartEdit: vi.fn(),
    onChange: vi.fn(),
    onCommit: vi.fn().mockResolvedValue(undefined),
    onCancel: vi.fn(),
    columnDef: mockColumnDef,
    rowContext: mockRowContext,
  };

  it('StringCell display mode: no critical violations', async () => {
    const { StringCell } = await import('../cells/StringCell');
    const { container } = render(<StringCell {...cellProps} value="hello" />);
    const results = await axe.run(container);
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical).toHaveLength(0);
  });

  it('BooleanCell display mode: no critical violations', async () => {
    const { BooleanCell } = await import('../cells/BooleanCell');
    const { container } = render(<BooleanCell {...cellProps} value={true} />);
    const results = await axe.run(container);
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical).toHaveLength(0);
  });

  it('NumberCell display mode: no critical violations', async () => {
    const { NumberCell } = await import('../cells/NumberCell');
    const { container } = render(<NumberCell {...cellProps} value={42} />);
    const results = await axe.run(container);
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical).toHaveLength(0);
  });

  it('DateCell display mode: no critical violations', async () => {
    const { DateCell } = await import('../cells/DateCell');
    const { container } = render(
      <DateCell {...cellProps} columnDef={{ ...mockColumnDef, type: 'date' }} value="2026-05-07" />,
    );
    const results = await axe.run(container);
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical).toHaveLength(0);
  });

  it('StringCell null value (redacted): no critical violations', async () => {
    const { StringCell } = await import('../cells/StringCell');
    const { container } = render(
      <StringCell {...cellProps} value={null} isRedacted={true} />,
    );
    const results = await axe.run(container);
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical).toHaveLength(0);
  });
});
