import { render } from '@testing-library/react';
import axe from 'axe-core';
import React from 'react';
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeAll } from 'vitest';

// next/navigation stubs
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
  useParams: () => ({ schemaSlug: 'test-schema', workspaceId: 'ws-123' }),
  useSearchParams: () => new URLSearchParams(),
}));

// Monaco editor — renders a plain textarea fallback in test (no WebWorker/canvas)
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange }: { value?: string; onChange?: (v: string) => void }) => (
    <textarea
      aria-label="SQL editor"
      value={value ?? ''}
      onChange={(e) => {
        onChange?.(e.target.value);
      }}
    />
  ),
}));

// @tanstack/react-virtual — mock to avoid layout measurement issues in jsdom
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    measureElement: vi.fn(),
  }),
}));

vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Tester', email: 'test@example.com' },
    refresh: vi.fn(),
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Stub fetch so the page component doesn't make real network calls
beforeAll(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({ items: [], columns: [], rowCount: 0, truncated: false, durationMs: 0 }),
  } as unknown as Response);
});

async function axeCheck(importFn: () => Promise<{ default: React.ComponentType }>) {
  const { default: Component } = await importFn();
  const { container } = render(<Component />);
  const results = await axe.run(container);
  return results.violations;
}

// ── ResultsPanel (rendered directly with props) ────────────────────────────────

describe('ResultsPanel accessibility', () => {
  it('empty state: no critical axe violations', async () => {
    const { ResultsPanel } = await import('../components/panels/ResultsPanel');
    const { container } = render(
      <ResultsPanel rows={[]} columns={[]} rowCount={0} truncated={false} durationMs={42} />,
    );
    const results = await axe.run(container);
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical).toHaveLength(0);
  });

  it('with rows and columns: no critical axe violations', async () => {
    const { ResultsPanel } = await import('../components/panels/ResultsPanel');
    const columns = [
      { name: 'id', type: 'uuid' },
      { name: 'name', type: 'text' },
      { name: 'active', type: 'boolean' },
    ];
    const rows = [
      { id: 'abc-123', name: 'Alice', active: true },
      { id: 'def-456', name: null, active: false },
    ];
    const { container } = render(
      <ResultsPanel rows={rows} columns={columns} rowCount={2} truncated={false} durationMs={17} />,
    );
    const results = await axe.run(container);
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical).toHaveLength(0);
  });

  it('truncated result: no critical axe violations', async () => {
    const { ResultsPanel } = await import('../components/panels/ResultsPanel');
    const { container } = render(
      <ResultsPanel
        rows={[{ id: '1', val: 'x' }]}
        columns={[{ name: 'id' }, { name: 'val' }]}
        rowCount={1000}
        truncated={true}
        durationMs={312}
      />,
    );
    const results = await axe.run(container);
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical).toHaveLength(0);
  });
});

// ── Workspace admin query settings page ───────────────────────────────────────

describe('Workspace admin query-settings page accessibility', () => {
  it('no critical axe violations', async () => {
    const violations = await axeCheck(
      () =>
        import('../../../../admin/workspaces/[workspaceId]/page') as Promise<{
          default: React.ComponentType;
        }>,
    );
    const critical = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toHaveLength(0);
  });
});
