'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PipelineStepper } from '../stepper';

// eslint-disable-next-line no-restricted-syntax -- client-side
const WORKSPACE_ID = process.env['NEXT_PUBLIC_DEFAULT_WORKSPACE_ID'] ?? 'default';

interface Message {
  role: 'ai' | 'user';
  text: string;
  reasoning?: string;
}

type BriefStatus = 'confident' | 'tentative' | 'empty';

interface BriefField {
  key: string;
  label: string;
  status: BriefStatus;
  content: string | null;
}

const INITIAL_MESSAGES: Message[] = [
  {
    role: 'ai',
    text: "Welcome — let's capture what you want to build. To start, can you describe in your own words what this tool needs to do, and who it's for?",
    reasoning: 'Why this question',
  },
  {
    role: 'user',
    text: 'I want to build a CRM for our sales team. About 8 reps. They need to track contacts, deals through stages, and notes from calls. Currently using spreadsheets.',
  },
  {
    role: 'ai',
    text: 'Helpful. A few clarifying questions:\n\n1. What "stages" do deals move through?\n2. Do reps need to see each other\'s deals, or only their own?\n3. Any integration requirements?',
    reasoning: 'Identifying scope: workflow + permissions + integrations',
  },
  {
    role: 'user',
    text: 'Stages: lead, qualified, proposal sent, negotiation, won, lost. Reps see all deals. Need email and calendar — Microsoft 365.',
  },
  {
    role: 'ai',
    text: 'Got it. Two more:\n\n1. Does any sales data need to be visible to non-sales (e.g., finance)?\n2. What does "success" look like 3 months in?',
    reasoning: 'Cross-functional access + success criteria',
  },
];

const BRIEF_FIELDS: BriefField[] = [
  {
    key: 'goals',
    label: 'Goals',
    status: 'confident',
    content:
      'Build a CRM to replace spreadsheet tracking; consolidate contacts, deals, call notes for an 8-person sales team.',
  },
  {
    key: 'target_users',
    label: 'Target users',
    status: 'confident',
    content: '8 sales reps; collaborative (all see all). Possibly read access for finance.',
  },
  {
    key: 'success_criteria',
    label: 'Success criteria',
    status: 'tentative',
    content: 'Reps abandon spreadsheets within 3 months; pipeline visible at a glance.',
  },
  {
    key: 'constraints',
    label: 'Constraints',
    status: 'confident',
    content: 'Microsoft 365 ecosystem. Internal-only.',
  },
  {
    key: 'in_scope',
    label: 'In scope',
    status: 'confident',
    content: 'Contacts, deals (6 stages), call notes, basic reporting, Outlook integration.',
  },
  {
    key: 'out_of_scope',
    label: 'Out of scope',
    status: 'tentative',
    content: 'Marketing automation, public portal. (Tentative)',
  },
  {
    key: 'assumptions',
    label: 'Assumptions',
    status: 'tentative',
    content: 'Reps will adopt; Microsoft 365 SSO.',
  },
  { key: 'risks', label: 'Risks', status: 'empty', content: null },
  { key: 'references', label: 'References', status: 'empty', content: null },
  {
    key: 'estimated_scope',
    label: 'Estimated scope',
    status: 'tentative',
    content: 'Medium (10-15 tables; 4-6 weeks of pipeline).',
  },
];

function statusDotStyle(status: BriefStatus): React.CSSProperties {
  const colors: Record<BriefStatus, string> = {
    confident: 'var(--fg-success)',
    tentative: 'var(--fg-warning)',
    empty: 'var(--border-emphasis)',
  };
  return { width: 8, height: 8, borderRadius: '50%', background: colors[status], flexShrink: 0 };
}

function briefSectionStyle(status: BriefStatus): React.CSSProperties {
  const styles: Record<BriefStatus, React.CSSProperties> = {
    confident: { borderColor: 'var(--fg-success)', background: 'var(--bg-success-subtle)' },
    tentative: { borderColor: 'var(--fg-warning)', background: 'var(--bg-warning-subtle)' },
    empty: { opacity: 0.5, background: 'var(--bg-surface)' },
  };
  return {
    padding: '10px 12px',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--shell-radius-md)',
    marginBottom: 8,
    ...styles[status],
  };
}

export default function IntentCapturePage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  async function handleStartBlank() {
    setIsCreating(true);
    try {
      const res = await fetch('/api/v1/ai/intent-capture/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: WORKSPACE_ID }),
      });
      const conv = (await res.json()) as { id: string };
      router.push(`/ai-pipeline/intent-capture/${conv.id}`);
    } catch {
      // fall back to demo view
      setIsCreating(false);
    }
  }

  function handleSend() {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: 'user', text: input }]);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PipelineStepper active="intent" />

      {/* Two-column layout: chat | brief */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 360px', flex: 1, overflow: 'hidden' }}
      >
        {/* Chat panel */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid var(--border-default)',
            background: 'var(--bg-surface)',
            overflow: 'hidden',
          }}
        >
          {/* Chat messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  maxWidth: 720,
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--fg-tertiary)',
                    marginBottom: 4,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  {msg.role === 'ai' ? 'AI' : 'You'}
                </div>
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--shell-radius-md)',
                    background:
                      msg.role === 'user' ? 'var(--accent-primary-subtle)' : 'var(--bg-surface)',
                    border: `1px solid ${msg.role === 'user' ? 'var(--accent-primary-subtle)' : 'var(--border-default)'}`,
                    fontSize: 14,
                    lineHeight: '22px',
                    color: 'var(--fg-primary)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.text}
                </div>
                {msg.reasoning && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--fg-tertiary)',
                      marginTop: 4,
                      cursor: 'pointer',
                    }}
                  >
                    ▸ {msg.reasoning}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Chat input bar */}
          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid var(--border-default)',
              display: 'flex',
              gap: 8,
              background: 'var(--bg-surface)',
              flexShrink: 0,
            }}
          >
            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type your response..."
              rows={2}
              style={{
                flex: 1,
                resize: 'none',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--shell-radius-sm)',
                padding: '8px 10px',
                fontSize: 13,
                lineHeight: '20px',
                background: 'var(--bg-input)',
                color: 'var(--fg-primary)',
                fontFamily: 'inherit',
                outline: 'none',
                minHeight: 36,
              }}
            />
            <button onClick={handleSend} className="pg-btn pg-btn-primary">
              Send
            </button>
          </div>
        </div>

        {/* Brief panel */}
        <div
          style={{ overflowY: 'auto', padding: 16, background: 'var(--bg-canvas)', flexShrink: 0 }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-primary)' }}>
              Intent Brief
            </div>
            <Link href="/ai-pipeline/prd-generation" className="pg-btn pg-btn-primary pg-btn-sm">
              Generate brief →
            </Link>
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-tertiary)', marginBottom: 16 }}>
            Updates as we talk.
          </div>

          {BRIEF_FIELDS.map((field) => (
            <div key={field.key} style={briefSectionStyle(field.status)}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--fg-secondary)',
                  }}
                >
                  {field.label}
                </div>
                <div style={statusDotStyle(field.status)} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-primary)', lineHeight: '18px' }}>
                {field.content ?? 'Not yet discussed.'}
              </div>
            </div>
          ))}

          <div style={{ fontSize: 12, color: 'var(--fg-tertiary)', marginTop: 16 }}>
            Cost so far: $0.34 of $50 monthly budget
          </div>

          <div
            style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-default)' }}
          >
            <button
              onClick={() => {
                void handleStartBlank();
              }}
              disabled={isCreating}
              className="pg-btn pg-btn-secondary"
              style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
            >
              {isCreating ? 'Starting…' : '+ New conversation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
