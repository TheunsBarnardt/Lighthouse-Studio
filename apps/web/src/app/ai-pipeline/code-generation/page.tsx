'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { PipelineStepper } from '../stepper';

type FnStatus = 'approved' | 'validated' | 'draft' | 'rejected';
type TriggerType = 'http' | 'schedule' | 'event' | 'integration';
type TabView = 'code' | 'manifest' | 'analysis' | 'tests';

interface ServerFunction {
  id: string;
  name: string;
  trigger: TriggerType;
  status: FnStatus;
  staticAnalysis: boolean;
  typeCheck: boolean;
}

interface FunctionGroup {
  label: TriggerType;
  items: ServerFunction[];
}

const FUNCTION_GROUPS: FunctionGroup[] = [
  {
    label: 'http',
    items: [
      {
        id: 'fn-1',
        name: 'updateDealStage',
        trigger: 'http',
        status: 'approved',
        staticAnalysis: true,
        typeCheck: true,
      },
      {
        id: 'fn-2',
        name: 'searchContacts',
        trigger: 'http',
        status: 'draft',
        staticAnalysis: true,
        typeCheck: true,
      },
      {
        id: 'fn-3',
        name: 'exportDealsCSV',
        trigger: 'http',
        status: 'draft',
        staticAnalysis: true,
        typeCheck: true,
      },
    ],
  },
  {
    label: 'schedule',
    items: [
      {
        id: 'fn-4',
        name: 'nightlyDealStaleness',
        trigger: 'schedule',
        status: 'draft',
        staticAnalysis: true,
        typeCheck: true,
      },
    ],
  },
  {
    label: 'event',
    items: [
      {
        id: 'fn-5',
        name: 'onContactCreated',
        trigger: 'event',
        status: 'draft',
        staticAnalysis: true,
        typeCheck: true,
      },
      {
        id: 'fn-6',
        name: 'onDealWon',
        trigger: 'event',
        status: 'validated',
        staticAnalysis: true,
        typeCheck: true,
      },
    ],
  },
  {
    label: 'integration',
    items: [
      {
        id: 'fn-7',
        name: 'outlookCalendarSync',
        trigger: 'integration',
        status: 'draft',
        staticAnalysis: false,
        typeCheck: true,
      },
    ],
  },
];

const FUNCTION_CODE = `import type { FunctionContext } from '@platform/runtime';

interface Input {
  dealId: string;
  newStage: 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
}

export async function updateDealStage(input: Input, ctx: FunctionContext) {
  const { sdk, logger } = ctx;
  const deal = await sdk.data('deals').where({ id: { _eq: input.dealId } }).one();
  if (!deal) throw new NotFoundError(\`Deal \${input.dealId} not found\`);
  const previousStage = deal.stage;
  await sdk.data('deals').where({ id: { _eq: input.dealId } }).update({ stage: input.newStage });
  if (input.newStage === 'won' && previousStage !== 'won') {
    await sdk.functions.onDealWon({ dealId: input.dealId });
  }
  logger.info('Deal stage updated', { dealId: input.dealId, from: previousStage, to: input.newStage });
  return { success: true, dealId: input.dealId, previousStage };
}`;

function statusDot(status: FnStatus) {
  const colors: Record<FnStatus, string> = {
    approved: 'var(--fg-success)',
    validated: 'var(--accent-primary)',
    draft: 'var(--border-emphasis)',
    rejected: 'var(--fg-danger)',
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

export default function CodeGenerationPage() {
  // FUNCTION_GROUPS.flatMap always has items since the literal is non-empty
  const [selectedFn, setSelectedFn] = useState<ServerFunction>(
    FUNCTION_GROUPS.flatMap((g) => g.items)[0],
  );
  const [activeTab, setActiveTab] = useState<TabView>('code');
  const [approvedSet, setApprovedSet] = useState<Set<string>>(new Set(['fn-1']));

  const allFns = FUNCTION_GROUPS.flatMap((g) => g.items);
  const totalFns = allFns.length;
  const approvedCount = approvedSet.size;

  function handleApprove() {
    setApprovedSet((prev) => new Set([...prev, selectedFn.id]));
  }

  function getStatus(fn: ServerFunction): FnStatus {
    if (approvedSet.has(fn.id)) return 'approved';
    return fn.status;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PipelineStepper active="code-gen" />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr 280px',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Left: function list */}
        <div
          style={{
            borderRight: '1px solid var(--border-default)',
            overflowY: 'auto',
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Server functions</div>
          <div style={{ fontSize: 11, marginBottom: 12 }}>7 functions · 2 integrations</div>
          {FUNCTION_GROUPS.map((group) => (
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
              {group.items.map((fn) => {
                const status = getStatus(fn);
                return (
                  <Button
                    key={fn.id}
                    onClick={() => {
                      setSelectedFn(fn);
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
                      background: fn.id === selectedFn.id ? 'var(--bg-selected)' : 'transparent',
                      color:
                        fn.id === selectedFn.id ? 'var(--accent-primary)' : 'var(--fg-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                      fontSize: 12,
                    }}
                  >
                    {statusDot(status)}
                    <span>{fn.name}</span>
                  </Button>
                );
              })}
            </div>
          ))}
          <div
            style={{
              marginTop: 16,
              paddingTop: 12,
              fontSize: 12,
            }}
          >
            {approvedCount}/{totalFns} approved
            <div
              style={{
                height: 3,
                borderRadius: 2,
                marginTop: 6,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: 'var(--fg-success)',
                  width: `${String((approvedCount / totalFns) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Center: function viewer */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
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
                <h1 style={{ fontSize: 18, fontFamily: 'monospace' }}>{selectedFn.name}</h1>
                <div style={{ fontSize: 12 }}>
                  {selectedFn.trigger.toUpperCase()} ·{' '}
                  {selectedFn.trigger === 'http'
                    ? 'POST /deals/:id/stage'
                    : selectedFn.trigger === 'schedule'
                      ? 'Nightly at 02:00 UTC'
                      : selectedFn.trigger === 'event'
                        ? 'on deal.stage.changed'
                        : 'Outlook Calendar API'}{' '}
                  · Sandboxed
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
                  disabled={approvedSet.has(selectedFn.id)}
                >
                  {approvedSet.has(selectedFn.id) ? '✓ Approved' : 'Approve'}
                </Button>
              </div>
            </div>
            <div style={{ display: 'flex' }}>
              {(['code', 'manifest', 'analysis', 'tests'] as TabView[]).map((tab) => (
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
                    color: activeTab === tab ? 'var(--accent-primary)' : 'var(--fg-secondary)',
                    borderBottom:
                      activeTab === tab
                        ? '2px solid var(--accent-primary)'
                        : '2px solid transparent',
                    fontWeight: activeTab === tab ? 500 : 400,
                  }}
                >
                  {tab === 'analysis'
                    ? 'Static analysis'
                    : tab === 'tests'
                      ? 'Tests preview'
                      : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
            {activeTab === 'code' && (
              <pre
                style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  lineHeight: '20px',
                  margin: 0,
                  padding: 16,
                  borderRadius: 'var(--shell-radius-md)',
                  border: '1px solid var(--border-default)',
                }}
              >
                {FUNCTION_CODE}
              </pre>
            )}
            {activeTab === 'manifest' && (
              <pre
                style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  lineHeight: '20px',
                  margin: 0,
                  padding: 16,
                  borderRadius: 'var(--shell-radius-md)',
                  border: '1px solid var(--border-default)',
                }}
              >
                {`{
  "name": "${selectedFn.name}",
  "trigger": "${selectedFn.trigger}",
  "timeout": 30,
  "memory": "256mb",
  "permissions": ["deals.read", "deals.update", "functions.invoke"],
  "network": "none"
}`}
              </pre>
            )}
            {activeTab === 'analysis' && (
              <div className="rounded-md border bg-card text-card-foreground p-4">
                <div className="mb-3 flex items-center justify-between border-b pb-3">
                  <span className="text-sm font-semibold">Static analysis results</span>
                </div>
                {[
                  ['eval / Function()', '✓ None', true],
                  ['child_process', '✓ None', true],
                  ['fs/net direct', '✓ None', true],
                  ['Sandbox escape patterns', '✓ None', true],
                  [
                    'Network allowlist violations',
                    selectedFn.staticAnalysis ? '✓ None' : '⚠ Detected',
                    selectedFn.staticAnalysis,
                  ],
                ].map(([k, v, pass]) => (
                  <div
                    key={k as string}
                    className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0"
                  >
                    <span className="text-muted-foreground">{k as string}</span>
                    <span
                      style={{
                        color: pass ? 'var(--fg-success)' : 'var(--fg-warning)',
                        fontWeight: 500,
                        fontSize: 13,
                      }}
                    >
                      {v as string}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'tests' && (
              <div
                style={{
                  fontSize: 13,
                  padding: 20,
                  textAlign: 'center',
                }}
              >
                Tests will be generated in Stage 8 (Test Generation)
              </div>
            )}
          </div>
        </div>

        {/* Right: inspector */}
        <div
          style={{
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
                marginBottom: 8,
              }}
            >
              REASONING
            </div>
            <div style={{ fontSize: 13, lineHeight: '20px' }}>
              Generated because UI's DealKanbanPage calls platform.functions.updateDealStage(). The
              "won" trigger derives from PRD FR-7.
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
              STATIC ANALYSIS
            </div>
            {(
              [
                ['eval / Function()', '✓ None', 'var(--fg-success)'],
                ['child_process', '✓ None', 'var(--fg-success)'],
                ['fs/net direct', '✓ None', 'var(--fg-success)'],
              ] as [string, string, string][]
            ).map(([k, v, c]) => (
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
              SANDBOX LIMITS
            </div>
            {[
              ['Timeout', '30s'],
              ['Memory', '256MB'],
              ['Network', 'none'],
            ].map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0"
              >
                <span className="text-muted-foreground">{k}</span>
                <span className="font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {v}
                </span>
              </div>
            ))}
          </div>

          <div style={{ paddingTop: 12 }}>
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
            {['deals.read', 'deals.update', 'functions.invoke'].map((p) => (
              <div
                key={p}
                className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0"
              >
                <span
                  className="text-muted-foreground"
                  style={{ fontFamily: 'monospace', fontSize: 11 }}
                >
                  {p}
                </span>
                <span style={{ fontWeight: 500 }}>✓</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
