'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';

import { PipelineStepper } from '../stepper';

type SectionStatus = 'approved' | 'in_review' | 'pending';

interface PrdSection {
  name: string;
  status: SectionStatus;
}

interface Requirement {
  id: string;
  title: string;
  description: string;
  priority: 'must' | 'should' | 'could';
  acceptanceCriteria?: string[];
  traces: string[];
}

const SECTIONS: PrdSection[] = [
  { name: '1. Overview', status: 'approved' },
  { name: '2. Goals & Success Metrics', status: 'approved' },
  { name: '3. Target Users & Personas', status: 'approved' },
  { name: '4. User Stories', status: 'approved' },
  { name: '5. Functional Requirements', status: 'in_review' },
  { name: '6. Non-Functional Requirements', status: 'in_review' },
  { name: '7. Constraints & Assumptions', status: 'approved' },
  { name: '8. Out of Scope', status: 'approved' },
  { name: '9. Open Questions', status: 'pending' },
  { name: '10. Risks & Mitigations', status: 'pending' },
];

const REQUIREMENTS: Requirement[] = [
  {
    id: 'FR-1',
    title: 'Contact management',
    description: 'Reps create, edit, view, and search contacts.',
    priority: 'must',
    acceptanceCriteria: [
      'As a sales rep, I want to add a new contact in under 30 seconds and have it sync to Outlook contacts.',
    ],
    traces: ['Goal-1', 'User Story US-3'],
  },
  {
    id: 'FR-2',
    title: 'Deal pipeline',
    description: 'Reps move deals through 6 stages.',
    priority: 'must',
    acceptanceCriteria: [
      'Given a deal in "qualified", when I drag to "proposal", then the deal updates and an audit entry is recorded.',
    ],
    traces: ['Goal-1', 'User Story US-5'],
  },
  {
    id: 'FR-3',
    title: 'Call notes attached to contacts',
    description: 'Reps add timestamped notes; searchable.',
    priority: 'must',
    acceptanceCriteria: [],
    traces: ['Goal-2'],
  },
  {
    id: 'FR-4',
    title: 'Outlook calendar integration',
    description: 'Meetings sync into deal timeline.',
    priority: 'should',
    acceptanceCriteria: [],
    traces: ['Constraint-1'],
  },
  {
    id: 'FR-5',
    title: 'Pipeline view (Kanban)',
    description: 'Reps see deals as a Kanban board.',
    priority: 'must',
    acceptanceCriteria: [],
    traces: ['Goal-1', 'User Story US-7'],
  },
];

function sectionDotColor(status: SectionStatus): string {
  if (status === 'approved') return 'oklch(0.40 0.14 145)';
  if (status === 'in_review') return 'oklch(0.45 0.14 75)';
  return 'var(--border)';
}

function priorityBadge(priority: Requirement['priority']) {
  if (priority === 'must')
    return (
      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
        MUST
      </span>
    );
  if (priority === 'should')
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
        SHOULD
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      COULD
    </span>
  );
}

export default function PrdGenerationPage() {
  const [activeSection, setActiveSection] = useState(4); // FR section active

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PipelineStepper active="prd" />

      {/* Three-pane layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr 280px',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Left: section list */}
        <div
          style={{
            borderRight: '1px solid var(--border)',
            overflowY: 'auto',
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Sections</div>
          {SECTIONS.map((section, i) => (
            <Button
              key={i}
              onClick={() => {
                setActiveSection(i);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                textAlign: 'left',
                padding: '6px 10px',
                borderRadius: '4px',
                marginBottom: 2,
                background: i === activeSection ? 'var(--accent)' : 'transparent',
                color: i === activeSection ? 'var(--primary)' : 'var(--muted-foreground)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: i === activeSection ? 500 : 400,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: sectionDotColor(section.status),
                  flexShrink: 0,
                }}
              />
              <span>{section.name}</span>
            </Button>
          ))}
        </div>

        {/* Center: requirements */}
        <div style={{ overflowY: 'auto', padding: 24 }}>
          <div className="mb-5 flex items-start justify-between gap-4" style={{ marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 18 }}>5. Functional Requirements</h1>
              <div className="subtitle">12 requirements Â· 3 traced to intent Â· In Review</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" type="button">
                Regenerate
              </Button>
              <Button size="sm" type="button">
                Approve section
              </Button>
            </div>
          </div>

          {REQUIREMENTS.map((req) => (
            <div
              key={req.id}
              className="rounded-md border bg-card text-card-foreground p-4"
              style={{ marginBottom: 12 }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                    style={{ fontFamily: 'monospace', fontSize: 11 }}
                  >
                    {req.id}
                  </span>
                  <strong style={{ fontSize: 13 }}>{req.title}</strong>
                  {priorityBadge(req.priority)}
                </div>
              </div>
              <div style={{ fontSize: 13, marginBottom: 10 }}>{req.description}</div>
              {req.acceptanceCriteria && req.acceptanceCriteria.length > 0 && (
                <>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: 6,
                    }}
                  >
                    ACCEPTANCE CRITERIA
                  </div>
                  {req.acceptanceCriteria.map((ac, i) => (
                    <div
                      key={i}
                      style={{
                        background: 'var(--muted)',
                        borderRadius: '4px',
                        padding: '8px 12px',
                        fontSize: 11,
                        fontFamily: 'monospace',
                        marginBottom: 6,
                        lineHeight: '16px',
                      }}
                    >
                      {ac}
                    </div>
                  ))}
                </>
              )}
              <div style={{ fontSize: 11, marginTop: 6 }}>
                Traces to:{' '}
                {req.traces.map((t, i) => (
                  <span key={t}>
                    <a href="#">{t}</a>
                    {i < req.traces.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            </div>
          ))}
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
              Extracted from user stories. Each FR is the minimum surface needed to support the
              workflow.
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
              APPROVAL ROUTING
            </div>
            <div
              className="rounded-md border bg-card text-card-foreground p-4"
              style={{ padding: 10 }}
            >
              {[
                { initials: 'JD', name: 'Joana de Klerk', role: 'Owner', approved: true },
                { initials: 'MA', name: 'Marcus Acker', role: 'Architect', approved: false },
              ].map((approver) => (
                <div
                  key={approver.initials}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}
                >
                  <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {approver.initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13 }}>{approver.name}</div>
                    <div style={{ fontSize: 11 }}>{approver.role}</div>
                  </div>
                  {approver.approved ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      âœ“
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      Pending
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, marginTop: 6 }}>Mode: All approvers required</div>
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
              ['This section', '$0.42'],
              ['Total PRD', '$2.10'],
            ].map(([key, val]) => (
              <div
                key={key}
                className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0"
              >
                <span className="text-muted-foreground">{key}</span>
                <span className="font-medium">{val}</span>
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
              QUALITY SIGNALS
            </div>
            {[
              ['Coverage of intent', '100%', 'oklch(0.40 0.14 145)'],
              ['Cross-section consistency', 'No conflicts', 'oklch(0.40 0.14 145)'],
            ].map(([key, val, color]) => (
              <div
                key={key}
                className="flex items-center justify-between border-b py-1.5 text-sm last:border-b-0"
              >
                <span className="text-muted-foreground">{key}</span>
                <span style={{ color: color }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
