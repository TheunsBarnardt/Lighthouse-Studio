'use client';

import { useState } from 'react';

import { PipelineStepper } from '../stepper';

type ComponentStatus = 'approved' | 'in_review' | 'pending';
type ViewTab = 'preview' | 'code' | 'storybook' | 'a11y';

interface ComponentItem {
  name: string;
  status: ComponentStatus;
}

interface ComponentGroup {
  label: string;
  items: ComponentItem[];
}

const COMPONENT_GROUPS: ComponentGroup[] = [
  {
    label: 'Pages',
    items: [
      { name: 'ContactsListPage', status: 'approved' },
      { name: 'ContactDetailPage', status: 'approved' },
      { name: 'DealKanbanPage', status: 'in_review' },
      { name: 'DealDetailPage', status: 'in_review' },
    ],
  },
  {
    label: 'Forms',
    items: [
      { name: 'ContactForm', status: 'approved' },
      { name: 'DealForm', status: 'in_review' },
      { name: 'ActivityForm', status: 'pending' },
    ],
  },
  {
    label: 'Tables',
    items: [
      { name: 'ContactsTable', status: 'approved' },
      { name: 'ActivitiesTimeline', status: 'approved' },
    ],
  },
  {
    label: 'Workflows',
    items: [
      { name: 'DealStageTransition', status: 'in_review' },
      { name: 'CSVContactImport', status: 'pending' },
    ],
  },
  {
    label: 'Auth',
    items: [
      { name: 'SignInPage', status: 'approved' },
      { name: 'MFASetup', status: 'approved' },
    ],
  },
];

function statusDot(status: ComponentStatus) {
  const colors: Record<ComponentStatus, string> = {
    approved: 'var(--fg-success)',
    in_review: 'var(--fg-warning)',
    pending: 'var(--border-emphasis)',
  };
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: colors[status],
        flexShrink: 0,
        display: 'inline-block',
      }}
    />
  );
}

// Mock deal kanban preview
function KanbanPreview() {
  const stages = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'];
  const dealCounts = [3, 2, 3, 2, 1, 1];
  const companies = ['Acme', 'Beta', 'Globex', 'Initech', 'Pied Piper', 'Hooli'];
  const amounts = [12, 24, 47, 89, 130, 56];

  return (
    <div
      style={{
        flex: 1,
        overflow: 'auto',
        background: 'oklch(0.99 0.002 145)',
        padding: 16,
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 600, color: 'oklch(0.20 0.01 145)' }}>
            Deal Pipeline
          </div>
          <div style={{ fontSize: 12, color: 'oklch(0.50 0.005 145)' }}>14 active · $387,420</div>
        </div>
        <button
          style={{
            background: 'oklch(0.50 0.16 145)',
            color: 'white',
            padding: '8px 14px',
            borderRadius: 6,
            border: 'none',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          + New deal
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        {stages.map((stage, i) => (
          <div
            key={stage}
            style={{ background: 'oklch(0.96 0.005 145)', borderRadius: 6, padding: 10 }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                color: 'oklch(0.40 0.005 145)',
                marginBottom: 8,
              }}
            >
              {stage}
            </div>
            {Array.from({ length: dealCounts[i] ?? 0 }).map((_, j) => (
              <div
                key={j}
                style={{
                  background: 'white',
                  border: '1px solid oklch(0.90 0.005 145)',
                  borderRadius: 4,
                  padding: 8,
                  marginBottom: 6,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 500, color: 'oklch(0.20 0.01 145)' }}>
                  {companies[(i * 3 + j) % 6]}
                </div>
                <div style={{ fontSize: 11, color: 'oklch(0.50 0.005 145)', marginTop: 2 }}>
                  ${amounts[(i * 3 + j) % 6]}k
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const MOCK_CODE = `'use client';

import { useQuery } from '@tanstack/react-query';
import { platform } from '../lib/platform';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const;

export function DealKanbanPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: () => platform.data('deals').list({ limit: 100 }),
  });

  const byStage = STAGES.reduce((acc, stage) => {
    acc[stage] = data?.rows.filter(d => d.stage === stage) ?? [];
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="px-6 py-4">
      <h1 className="text-xl font-semibold mb-4">Deal Pipeline</h1>
      <div className="grid grid-cols-6 gap-3">
        {STAGES.map(stage => (
          <div key={stage} className="bg-muted/40 rounded-lg p-3">
            <div className="text-xs font-semibold uppercase mb-2">{stage}</div>
            {byStage[stage].map(deal => (
              <div key={deal.id} className="bg-background border rounded p-2 mb-2">
                <div className="text-sm font-medium">{deal.title}</div>
                <div className="text-xs text-muted-foreground">\${deal.amount}k</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}`;

export default function UiGenerationPage() {
  const [selectedComponent, setSelectedComponent] = useState('DealKanbanPage');
  const [activeTab, setActiveTab] = useState<ViewTab>('preview');
  const [approvedSet, setApprovedSet] = useState<Set<string>>(
    new Set([
      'ContactsListPage',
      'ContactDetailPage',
      'ContactForm',
      'ContactsTable',
      'ActivitiesTimeline',
      'SignInPage',
      'MFASetup',
    ]),
  );

  const totalComponents = COMPONENT_GROUPS.reduce((sum, g) => sum + g.items.length, 0);
  const approvedCount = approvedSet.size;

  function handleApprove() {
    setApprovedSet((prev) => new Set([...prev, selectedComponent]));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PipelineStepper active="ui-gen" />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr 280px',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Left: component tree */}
        <div
          style={{
            background: 'var(--bg-surface)',
            borderRight: '1px solid var(--border-default)',
            overflowY: 'auto',
            padding: 12,
          }}
        >
          <div
            style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, color: 'var(--fg-primary)' }}
          >
            Generated components
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-tertiary)', marginBottom: 12 }}>
            14 · Permission-aware · WCAG AA
          </div>
          {COMPONENT_GROUPS.map((group) => (
            <div key={group.label}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--fg-tertiary)',
                  padding: '8px 8px 4px',
                }}
              >
                {group.label}
              </div>
              {group.items.map((item) => {
                const status = approvedSet.has(item.name)
                  ? ('approved' as ComponentStatus)
                  : item.status;
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      setSelectedComponent(item.name);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      width: '100%',
                      textAlign: 'left',
                      padding: '4px 8px',
                      borderRadius: 'var(--shell-radius-sm)',
                      marginBottom: 1,
                      background:
                        item.name === selectedComponent ? 'var(--bg-selected)' : 'transparent',
                      color:
                        item.name === selectedComponent
                          ? 'var(--accent-primary)'
                          : 'var(--fg-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                      fontSize: 12,
                    }}
                  >
                    {statusDot(status)}
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Center: component viewer */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            background: 'var(--bg-canvas)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 20px',
              borderBottom: '1px solid var(--border-default)',
              background: 'var(--bg-surface)',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 8,
              }}
            >
              <div>
                <h1 style={{ fontSize: 18, color: 'var(--fg-primary)' }}>{selectedComponent}</h1>
                <div style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>
                  142 lines · React + Tailwind · 0 lint errors · 0 a11y failures
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="pg-btn pg-btn-secondary pg-btn-sm">Regenerate</button>
                <button
                  onClick={handleApprove}
                  disabled={approvedSet.has(selectedComponent)}
                  className="pg-btn pg-btn-primary pg-btn-sm"
                >
                  {approvedSet.has(selectedComponent) ? '✓ Approved' : 'Approve'}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 0, borderBottom: 'none' }}>
              {(['preview', 'code', 'storybook', 'a11y'] as ViewTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                  }}
                  style={{
                    padding: '5px 14px',
                    fontSize: 12,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    color: activeTab === tab ? 'var(--accent-primary)' : 'var(--fg-secondary)',
                    borderBottom:
                      activeTab === tab
                        ? '2px solid var(--accent-primary)'
                        : '2px solid transparent',
                    fontWeight: activeTab === tab ? 500 : 400,
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* App preview bar + content */}
          {activeTab === 'preview' && (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  background: 'var(--bg-surface)',
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 11,
                  color: 'var(--fg-tertiary)',
                }}
              >
                <span style={{ display: 'inline-flex', gap: 4 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: '#FF5F57',
                      display: 'inline-block',
                    }}
                  />
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: '#FFBD2E',
                      display: 'inline-block',
                    }}
                  />
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: '#28C840',
                      display: 'inline-block',
                    }}
                  />
                </span>
                <div
                  style={{
                    flex: 1,
                    background: 'var(--bg-surface-2)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--shell-radius-sm)',
                    padding: '4px 12px',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    color: 'var(--fg-secondary)',
                  }}
                >
                  app.acme.example.com/deals
                </div>
                <span>Mock · 14 deals</span>
              </div>
              <KanbanPreview />
            </div>
          )}

          {activeTab === 'code' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              <pre
                style={{
                  fontFamily: 'monospace',
                  fontSize: 11,
                  lineHeight: '18px',
                  color: 'var(--fg-primary)',
                  margin: 0,
                  background: 'var(--bg-surface)',
                  padding: 16,
                  borderRadius: 'var(--shell-radius-md)',
                  border: '1px solid var(--border-default)',
                  overflow: 'auto',
                }}
              >
                {MOCK_CODE}
              </pre>
            </div>
          )}

          {(activeTab === 'storybook' || activeTab === 'a11y') && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--fg-tertiary)',
                fontSize: 13,
              }}
            >
              {activeTab === 'storybook'
                ? 'Storybook story would render here'
                : 'Axe-core a11y report: 0 violations'}
            </div>
          )}
        </div>

        {/* Right: inspector */}
        <div
          style={{
            background: 'var(--bg-surface)',
            borderLeft: '1px solid var(--border-default)',
            overflowY: 'auto',
            padding: 16,
          }}
        >
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--fg-tertiary)',
                marginBottom: 8,
              }}
            >
              REASONING
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-secondary)', lineHeight: '20px' }}>
              Kanban generated because PRD FR-5 specified drag-between-stages.
            </div>
          </div>

          <div
            style={{
              marginBottom: 16,
              paddingTop: 12,
              borderTop: '1px solid var(--border-default)',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--fg-tertiary)',
                marginBottom: 8,
              }}
            >
              QUALITY
            </div>
            {[
              ['TypeScript', '✓', 'var(--fg-success)'],
              ['ESLint', '✓', 'var(--fg-success)'],
              ['axe-core', '✓ AA', 'var(--fg-success)'],
              ['Mobile', '✓', 'var(--fg-success)'],
            ].map(([k, v, c]) => (
              <div key={k} className="pg-inspector-row">
                <span className="pg-inspector-key">{k}</span>
                <span style={{ color: c, fontWeight: 500, fontSize: 13 }}>{v}</span>
              </div>
            ))}
          </div>

          <div
            style={{
              marginBottom: 16,
              paddingTop: 12,
              borderTop: '1px solid var(--border-default)',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--fg-tertiary)',
                marginBottom: 8,
              }}
            >
              PERMISSIONS
            </div>
            {[
              ['View deals', 'deals.read'],
              ['Edit deals', 'deals.update'],
            ].map(([k, v]) => (
              <div key={k} className="pg-inspector-row">
                <span className="pg-inspector-key">{k}</span>
                <span
                  style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--fg-secondary)' }}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              marginBottom: 16,
              paddingTop: 12,
              borderTop: '1px solid var(--border-default)',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--fg-tertiary)',
                marginBottom: 8,
              }}
            >
              COST
            </div>
            {[
              ['This component', '$1.84'],
              ['Total project', '$18.50'],
            ].map(([k, v]) => (
              <div key={k} className="pg-inspector-row">
                <span className="pg-inspector-key">{k}</span>
                <span className="pg-inspector-val">{v}</span>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div style={{ paddingTop: 12, borderTop: '1px solid var(--border-default)' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: 'var(--fg-secondary)',
                marginBottom: 6,
              }}
            >
              <span>Progress</span>
              <span>
                {approvedCount}/{totalComponents} approved
              </span>
            </div>
            <div
              style={{
                height: 4,
                background: 'var(--bg-hover)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: 'var(--accent-primary)',
                  width: `${String((approvedCount / totalComponents) * 100)}%`,
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
