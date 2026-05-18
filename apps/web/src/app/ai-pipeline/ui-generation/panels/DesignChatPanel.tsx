'use client';

import { ArrowUp, Paperclip, Plus, Search, Sparkles, Wrench, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { ModelPicker } from '@/components/ai/ModelPicker';
import { getDefaultModel } from '@/lib/ai/model-registry';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

interface DesignChatPanelProps {
  recentEdits?: { kind: 'edited' | 'inserted' | 'removed'; target: string }[];
  onAssistantBlockInsert?: (blockId: string) => void;
}

const EXAMPLE_PROMPTS = [
  'Make the navbar dark and remove the second CTA',
  'Add a pricing section with 3 tiers',
  'Replace the hero with a split layout that has a screenshot on the right',
  'Make the form full-width and centered',
];

/**
 * Design chat panel — t3.chat-style.
 *
 * Layout (top to bottom):
 *   - Header: "Design chat" title + "New" button (clears thread, keeps model).
 *   - Conversation: assistant turns with AI tag and streaming caret; user
 *     turns as right-aligned bubbles. Empty state shows example prompts.
 *   - System events (visual edits, block insertions) inline between turns.
 *   - Composer: textarea + bottom toolbar with model pill on the left,
 *     attach/web inline buttons (decorative for v1), Send icon on the right.
 *
 * Real SSE streaming via the /api/v1/ai-pipeline/ui-generation/compose endpoint.
 * Block_insert events bubble up via onAssistantBlockInsert.
 */
export function DesignChatPanel({ recentEdits, onAssistantBlockInsert }: DesignChatPanelProps) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [modelId, setModelId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('lighthouse.designChatModelId');
      if (saved) return saved;
    }
    return getDefaultModel().id;
  });
  const [webOn, setWebOn] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('lighthouse.designChatModelId', modelId);
    }
  }, [modelId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length, recentEdits?.length]);

  function newChat() {
    setTurns([]);
    setInput('');
    textareaRef.current?.focus();
  }

  async function send(initial?: string) {
    const text = (initial ?? input).trim();
    if (!text || busy) return;
    const userTurn: ChatTurn = { id: crypto.randomUUID(), role: 'user', content: text };
    const assistantId = crypto.randomUUID();
    setTurns((prev) => [
      ...prev,
      userTurn,
      { id: assistantId, role: 'assistant', content: '', isStreaming: true },
    ]);
    setInput('');
    setBusy(true);

    try {
      const res = await fetch('/api/v1/ai-pipeline/ui-generation/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: text, model: modelId, mode: 'modify' }),
      });
      if (!res.body) throw new Error('No response body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantText = '';

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const ev = JSON.parse(data) as { type: string } & Record<string, unknown>;
            if (ev.type === 'text_delta' && typeof ev['delta'] === 'string') {
              assistantText += ev['delta'];
              const snapshot = assistantText;
              setTurns((prev) =>
                prev.map((t) => (t.id === assistantId ? { ...t, content: snapshot } : t)),
              );
            } else if (ev.type === 'block_insert' && typeof ev['blockId'] === 'string') {
              onAssistantBlockInsert?.(ev['blockId']);
            } else if (ev.type === 'reasoning' && typeof ev['text'] === 'string') {
              const note = `\n\n_${ev['text']}_`;
              assistantText += note;
              const snapshot = assistantText;
              setTurns((prev) =>
                prev.map((t) => (t.id === assistantId ? { ...t, content: snapshot } : t)),
              );
            }
          } catch {
            // skip malformed events
          }
        }
      }
      setTurns((prev) =>
        prev.map((t) => (t.id === assistantId ? { ...t, isStreaming: false } : t)),
      );
    } catch (e) {
      setTurns((prev) =>
        prev.map((t) =>
          t.id === assistantId
            ? {
                ...t,
                content: `Error: ${e instanceof Error ? e.message : String(e)}`,
                isStreaming: false,
              }
            : t,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  const empty = turns.length === 0 && (!recentEdits || recentEdits.length === 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--muted-foreground)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          Design chat
          <span
            style={{
              fontSize: 9,
              padding: '1px 6px',
              borderRadius: 999,
              background: 'color-mix(in srgb, var(--primary) 14%, transparent)',
              color: 'var(--primary)',
              letterSpacing: 0,
            }}
          >
            PREVIEW
          </span>
        </span>
        {!empty && (
          <button
            type="button"
            onClick={newChat}
            title="New conversation"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              padding: '3px 7px',
              border: '1px solid var(--border)',
              borderRadius: 4,
              background: 'transparent',
              color: 'var(--muted-foreground)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: 0,
              textTransform: 'none',
            }}
          >
            <Plus style={{ width: 10, height: 10 }} />
            New
          </button>
        )}
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: empty ? 16 : '12px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {empty ? (
          <EmptyState
            onPick={(p) => {
              void send(p);
            }}
          />
        ) : (
          <>
            {recentEdits?.map((e, i) => (
              <SystemEvent key={`e-${String(i)}`} kind={e.kind} target={e.target} />
            ))}
            {turns.map((t) => (
              <Turn key={t.id} turn={t} />
            ))}
            <div ref={endRef} />
          </>
        )}
      </div>

      <div
        style={{
          padding: 10,
          borderTop: '1px solid var(--border)',
          background: 'var(--card)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 8,
            background: 'var(--background)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            transition: 'border-color 120ms',
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder="Ask the AI to modify the design…"
            style={{
              padding: '2px 4px',
              border: 'none',
              fontSize: 13,
              resize: 'none',
              fontFamily: 'inherit',
              background: 'transparent',
              color: 'var(--foreground)',
              outline: 'none',
              minHeight: 36,
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ModelPicker
                selectedId={modelId}
                onSelect={(id) => {
                  setModelId(id);
                }}
              />
              <ComposerPill title="Instant — faster, may be less thorough" disabled>
                <Zap style={{ width: 11, height: 11 }} />
                Instant
              </ComposerPill>
              <ComposerPill
                title="Web search"
                active={webOn}
                onClick={() => {
                  setWebOn((v) => !v);
                }}
              >
                <Search style={{ width: 11, height: 11 }} />
                Search
              </ComposerPill>
              <ComposerPill title="Attach (coming soon)" disabled>
                <Paperclip style={{ width: 11, height: 11 }} />
                Attach
              </ComposerPill>
            </div>
            <button
              type="button"
              onClick={() => {
                void send();
              }}
              disabled={!input.trim() || busy}
              title="Send (Enter)"
              style={{
                width: 32,
                height: 32,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                border: 'none',
                background:
                  input.trim() && !busy
                    ? 'linear-gradient(135deg, oklch(0.65 0.22 320), oklch(0.62 0.20 280))'
                    : 'var(--muted)',
                color: input.trim() && !busy ? 'white' : 'var(--muted-foreground)',
                cursor: input.trim() && !busy ? 'pointer' : 'not-allowed',
                transition: 'transform 120ms, background 120ms',
                flexShrink: 0,
              }}
            >
              <ArrowUp style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        color: 'var(--muted-foreground)',
        textAlign: 'center',
      }}
    >
      <Sparkles style={{ width: 22, height: 22, color: 'var(--primary)' }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>
          What should this app feel like?
        </div>
        <div style={{ fontSize: 11, marginTop: 4 }}>
          Pick a starter prompt or describe a change.
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
        {EXAMPLE_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              onPick(p);
            }}
            style={{
              padding: '7px 10px',
              border: '1px solid var(--border)',
              borderRadius: 8,
              background: 'transparent',
              color: 'var(--foreground)',
              fontSize: 11,
              textAlign: 'left',
              cursor: 'pointer',
              fontFamily: 'inherit',
              lineHeight: 1.4,
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function Turn({ turn }: { turn: ChatTurn }) {
  const isUser = turn.role === 'user';
  return (
    <div
      style={{
        alignSelf: isUser ? 'flex-end' : 'stretch',
        maxWidth: isUser ? '90%' : '100%',
      }}
    >
      {!isUser && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--muted-foreground)',
            marginBottom: 4,
            fontWeight: 600,
          }}
        >
          <Sparkles style={{ width: 10, height: 10, color: 'var(--primary)' }} />
          Assistant
        </div>
      )}
      <div
        style={{
          background: isUser ? 'var(--accent)' : 'transparent',
          color: 'var(--foreground)',
          borderRadius: 12,
          padding: isUser ? '8px 12px' : '2px 0',
          fontSize: 12.5,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          border: isUser ? '1px solid color-mix(in srgb, var(--primary) 14%, transparent)' : 'none',
        }}
      >
        {turn.content}
        {turn.isStreaming && (
          <span
            aria-hidden
            style={{
              display: 'inline-block',
              width: 7,
              height: 11,
              marginLeft: 2,
              verticalAlign: 'text-bottom',
              background: 'var(--primary)',
              opacity: 0.75,
              animation: 'lh-blink 800ms steps(2) infinite',
            }}
          />
        )}
      </div>
    </div>
  );
}

if (typeof document !== 'undefined' && !document.getElementById('lh-blink-style')) {
  const style = document.createElement('style');
  style.id = 'lh-blink-style';
  style.textContent = `@keyframes lh-blink { 0%, 100% { opacity: 0.85; } 50% { opacity: 0.15; } }`;
  document.head.appendChild(style);
}

function SystemEvent({
  kind,
  target,
}: {
  kind: 'edited' | 'inserted' | 'removed';
  target: string;
}) {
  const verb = kind === 'edited' ? 'Edited' : kind === 'inserted' ? 'Inserted' : 'Removed';
  return (
    <div
      style={{
        alignSelf: 'flex-start',
        fontSize: 10,
        color: 'var(--muted-foreground)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 6px',
      }}
    >
      <Wrench style={{ width: 10, height: 10 }} />
      <span>
        {verb} <span style={{ fontFamily: 'monospace', color: 'var(--foreground)' }}>{target}</span>
      </span>
    </div>
  );
}

function ComposerPill({
  children,
  title,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 9px',
        border: '1px solid var(--border)',
        borderRadius: 999,
        background: active ? 'var(--accent)' : 'transparent',
        color: active
          ? 'var(--primary)'
          : disabled
            ? 'color-mix(in srgb, var(--muted-foreground) 50%, transparent)'
            : 'var(--muted-foreground)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 11,
        fontWeight: 500,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}
