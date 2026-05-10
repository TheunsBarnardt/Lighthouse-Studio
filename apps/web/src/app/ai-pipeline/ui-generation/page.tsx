'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

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
    approved: 'oklch(0.40 0.14 145)',
    in_review: 'oklch(0.45 0.14 75)',
    pending: 'var(--border)',
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
          <div style={{ fontSize: 12, color: 'oklch(0.50 0.005 145)' }}>14 active Â· $387,420</div>
        </div>
        <Button
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
        </Button>
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

import { Button } from '@/components/ui/button';

const STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const;

export function DealKanbanPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['deals'],
    queryFn: () => platform.data('deals').list({ limit: 100 })
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
            borderRight: '1px solid var(--border)',
            overflowY: 'auto',
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Generated components</div>
          <div style={{ fontSize: 11, marginBottom: 12 }}>14 Â· Permission-aware Â· WCAG AA</div>
          {COMPONENT_GROUPS.map((group) => (
            <div key={group.label}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
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
                  <Button
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
                      borderRadius: '4px',
                      marginBottom: 1,
                      background:
                        item.name === selectedComponent ? 'var(--accent)' : 'transparent',
                      color:
                        item.name === selectedComponent
                          ? 'var(--primary)'
                          : 'var(--muted-foreground)',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                      fontSize: 12,
                    }}
                  >
                    {statusDot(status)}
                    <span>{item.name}</span>
                  </Button>
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
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '12px 20px',
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
                <h1 style={{ fontSize: 18 }}>{selectedComponent}</h1>
                <div style={{ fontSize: 12 }}>
                  142 lines Â· React + Tailwind Â· 0 lint errors Â· 0 a11y failures
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="outline" size="sm" type="button">
                  Regenerate
                </Button>
                <Button
                  size="sm"
                  type="button"
                  onClick={handleApprove}
                  disabled={approvedSet.has(selectedComponent)}
                >
                  {approvedSet.has(selectedComponent) ? 'âœ“ Approved' : 'Approve'}
                </Button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 0, borderBottom: 'none' }}>
              {(['preview', 'code', 'storybook', 'a11y'] as ViewTab[]).map((tab) => (
                <Button
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
                    color: activeTab === tab ? 'var(--primary)' : 'var(--muted-foreground)',
                    borderBottom:
                      activeTab === tab
                        ? '2px solid var(--primary)'
                        : '2px solid transparent',
                    fontWeight: activeTab === tab ? 500 : 400,
                  }}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* App preview bar + content */}
          {activeTab === 'preview' && (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 11,
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
                    background: 'var(--muted)',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    padding: '4px 12px',
                    fontFamily: 'monospace',
                    fontSize: 11,
                  }}
                >
                  app.acme.example.com/deals
                </div>
                <span>Mock Â· 14 deals</span>
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
                  margin: 0,
                  padding: 16,
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
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
            borderLeft: '1px solid var(--border)',
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
                marginBottom: 8,
              }}
            >
              REASONING
            </div>
            <div style={{ fontSize: 13, lineHeight: '20px' }}>
              Kanban generated because PRD FR-5 specified drag-between-stages.
            </div>
          </div>

          <div
            style={{
              marginBottom: 16,
              paddingTop: 12,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 8,
              }}
            >
              QUALITY
            </div>
            {[
              ['TypeScript', 'âœ“', 'oklch(0.40 0.14 145)'],
              ['ESLint', 'âœ“', 'oklch(0.40 0.14 145)'],
              ['axe-core', 'âœ“ AA', 'oklch(0.40 0.14 145)'],
              ['Mobile', 'âœ“', 'oklch(0.40 0.14 145)'],
            ].map(([k, v, c]) => (
              <div
                key={k}
                className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0"
              >
                <span className="text-muted-foreground">{k}</span>
                <span style={{ color: c, fontWeight: 500, fontSize: 13 }}>{v}</span>
              </div>
            ))}
          </div>

          <div
            style={{
              marginBottom: 16,
              paddingTop: 12,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 8,
              }}
            >
              PERMISSIONS
            </div>
            {[
              ['View deals', 'deals.read'],
              ['Edit deals', 'deals.update'],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0"
              >
                <span className="text-muted-foreground">{k}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{v}</span>
              </div>
            ))}
          </div>

          <div
            style={{
              marginBottom: 16,
              paddingTop: 12,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 8,
              }}
            >
              COST
            </div>
            {[
              ['This component', '$1.84'],
              ['Total project', '$18.50'],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0"
              >
                <span className="text-muted-foreground">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div style={{ paddingTop: 12 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
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
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: 'var(--primary)',
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
