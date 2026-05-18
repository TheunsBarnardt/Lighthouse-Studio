'use client';

import {
  ArrowUp,
  Code as CodeIcon,
  GraduationCap,
  Newspaper,
  Paperclip,
  Plus,
  Search,
  Sparkles,
  Wrench,
} from 'lucide-react';
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

/**
 * Design chat panel — ported from the open-source t3.chat clone
 * `TGlide/thom-chat` (cloneathon winner; t3.chat itself is closed-source).
 *
 * Key visual choices copied from `src/routes/chat/+layout.svelte` and
 * `src/routes/chat/[id]/message.svelte` in thom-chat:
 *   - Empty state with category pills (Create / Explore / Code / Learn) and
 *     a suggestion list below the selected category.
 *   - User bubble: bg-secondary/50 + border-secondary/70, self-end, rounded.
 *   - Assistant: no bubble, just text (prose).
 *   - Composer wrapped in a glowing rounded-t-[20px] card with multi-layer
 *     drop shadow and a border-reflect gradient on focus.
 *   - Pills row to the left of the Send button: model picker, web search.
 *   - Send button: 36x36 rounded-lg with reflective gradient border.
 *   - 3 bouncing dots while the AI is "thinking" (no content yet).
 *
 * Real SSE streaming via /api/v1/ai-pipeline/ui-generation/compose. Inserted
 * blocks bubble up via onAssistantBlockInsert.
 */
const CATEGORIES = [
  {
    id: 'design',
    icon: Sparkles,
    label: 'Design',
    prompts: [
      'Make the navbar dark and remove the second CTA',
      'Add a pricing section with 3 tiers',
      'Replace the hero with a split layout — screenshot on the right',
      'Make the form full-width and centered',
    ],
  },
  {
    id: 'compose',
    icon: Newspaper,
    label: 'Compose',
    prompts: [
      'Lay out a marketing landing page for a developer tool',
      'Build a CRM dashboard with stats and a recent-activity table',
      'Make a SaaS pricing page with FAQs and a CTA',
      'A two-tab onboarding flow with progress',
    ],
  },
  {
    id: 'code',
    icon: CodeIcon,
    label: 'Code',
    prompts: [
      'Change the hero h1 to use text-balance and a gradient',
      'Switch every button to the primary brand color',
      'Stack the feature grid into one column on mobile',
      'Add hover scale-105 on the pricing cards',
    ],
  },
  {
    id: 'learn',
    icon: GraduationCap,
    label: 'Learn',
    prompts: [
      'Why does my preview show a stale brand color?',
      'What blocks are in the library right now?',
      'How do I bind a placeholder to a schema field?',
      'When should I use the Generate UI button vs the chat?',
    ],
  },
];

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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
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
    setSelectedCategory(null);
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
    setSelectedCategory(null);

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
  const activeCategory = CATEGORIES.find((c) => c.id === selectedCategory) ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
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
          padding: empty ? '0 12px' : '12px 12px 140px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {empty ? (
          <EmptyState
            activeId={selectedCategory}
            onPickCategory={setSelectedCategory}
            activeCategory={activeCategory}
            onPickPrompt={(p) => {
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
            {busy && turns[turns.length - 1]?.content === '' && <LoadingDots />}
            <div ref={endRef} />
          </>
        )}
      </div>

      {/*
       * Composer — multi-layer drop shadow + border-reflect gradient via a
       * CSS-only ::before mask is hard in inline styles, so we layer an
       * outer rounded card with backdrop-blur, plus a primary-tinted outline
       * that brightens on focus-within. Matches thom-chat's composer shell.
       */}
      <div
        style={{
          padding: 10,
          borderTop: '1px solid var(--border)',
          background:
            'linear-gradient(180deg, transparent, color-mix(in srgb, var(--card) 92%, transparent) 28%, var(--card))',
          flexShrink: 0,
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '10px 10px 8px',
            border: '1px solid color-mix(in srgb, var(--primary) 14%, var(--border))',
            borderRadius: 16,
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--background) 92%, transparent), var(--background))',
            outline: '8px solid color-mix(in srgb, var(--primary) 6%, transparent)',
            outlineOffset: -1,
            boxShadow:
              '0 80px 50px rgba(0,0,0,0.10), 0 50px 30px rgba(0,0,0,0.07), 0 30px 15px rgba(0,0,0,0.06), 0 15px 8px rgba(0,0,0,0.04), 0 6px 4px rgba(0,0,0,0.04), 0 2px 2px rgba(0,0,0,0.02)',
            transition: 'outline-color 200ms',
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
            placeholder={
              empty ? 'Ask anything — design, compose, code, learn…' : 'Modify the design…'
            }
            disabled={busy}
            style={{
              minHeight: 56,
              maxHeight: 200,
              padding: '4px 6px',
              border: 'none',
              fontSize: 14,
              lineHeight: 1.45,
              resize: 'none',
              fontFamily: 'inherit',
              background: 'transparent',
              color: 'var(--foreground)',
              outline: 'none',
              overflowY: 'auto',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <ModelPicker
                selectedId={modelId}
                onSelect={(id) => {
                  setModelId(id);
                }}
              />
              <ComposerPill
                title="Web search"
                active={webOn}
                onClick={() => {
                  setWebOn((v) => !v);
                }}
              >
                <Search style={{ width: 12, height: 12 }} />
                Search
              </ComposerPill>
              <ComposerPill title="Attach (coming soon)" disabled>
                <Paperclip style={{ width: 12, height: 12 }} />
                Attach
              </ComposerPill>
            </div>
            <button
              type="submit"
              disabled={!input.trim() || busy}
              title="Send (Enter)"
              style={{
                width: 36,
                height: 36,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                background:
                  input.trim() && !busy
                    ? 'linear-gradient(135deg, oklch(0.62 0.20 280), oklch(0.65 0.22 320))'
                    : 'color-mix(in srgb, var(--muted) 80%, transparent)',
                color: input.trim() && !busy ? 'white' : 'var(--muted-foreground)',
                cursor: input.trim() && !busy ? 'pointer' : 'not-allowed',
                transition: 'transform 120ms, background 120ms, box-shadow 120ms',
                flexShrink: 0,
                boxShadow:
                  input.trim() && !busy
                    ? '0 2px 8px color-mix(in srgb, oklch(0.62 0.20 280) 40%, transparent)'
                    : 'none',
              }}
            >
              <ArrowUp style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EmptyState({
  activeId,
  activeCategory,
  onPickCategory,
  onPickPrompt,
}: {
  activeId: string | null;
  activeCategory: (typeof CATEGORIES)[number] | null;
  onPickCategory: (id: string | null) => void;
  onPickPrompt: (p: string) => void;
}) {
  // Default suggestions = pick from across categories for variety.
  const defaults = [
    CATEGORIES[0].prompts[0],
    CATEGORIES[1].prompts[0],
    CATEGORIES[2].prompts[0],
    CATEGORIES[3].prompts[0],
  ];
  const suggestions = activeCategory ? activeCategory.prompts : defaults;
  return (
    <div style={{ padding: '14px 0 0' }}>
      <h2
        style={{
          fontFamily: 'ui-serif, Georgia, serif',
          fontSize: 22,
          fontWeight: 600,
          margin: '0 0 12px',
          color: 'var(--foreground)',
        }}
      >
        Hey there.
      </h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const isActive = activeId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onPickCategory(isActive ? null : c.id);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 999,
                border: '1px solid var(--border)',
                background: isActive
                  ? 'linear-gradient(135deg, oklch(0.62 0.20 280), oklch(0.65 0.22 320))'
                  : 'var(--muted)',
                color: isActive ? 'white' : 'var(--foreground)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 500,
                transition: 'background 150ms',
              }}
            >
              <Icon style={{ width: 13, height: 13 }} />
              {c.label}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 4 }}>
        {suggestions.map((p, i) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              onPickPrompt(p);
            }}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '10px 2px',
              borderTop: i === 0 ? 'none' : '1px solid var(--border)',
              borderLeft: 'none',
              borderRight: 'none',
              borderBottom: 'none',
              background: 'transparent',
              color: 'var(--foreground)',
              fontSize: 12.5,
              cursor: 'pointer',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              transition: 'color 150ms',
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
  if (isUser) {
    return (
      <div
        style={{
          alignSelf: 'flex-end',
          maxWidth: '92%',
          padding: '6px 10px',
          borderRadius: 12,
          fontSize: 12.5,
          lineHeight: 1.5,
          background: 'color-mix(in srgb, var(--accent) 70%, transparent)',
          border: '1px solid color-mix(in srgb, var(--primary) 14%, transparent)',
          color: 'var(--foreground)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {turn.content}
      </div>
    );
  }
  return (
    <div
      style={{
        alignSelf: 'stretch',
        padding: '2px 2px',
        color: 'var(--foreground)',
        fontSize: 12.5,
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {turn.content}
      {turn.isStreaming && turn.content.length > 0 && (
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
  );
}

function LoadingDots() {
  // Direct port of thom-chat/src/routes/chat/[id]/loading-dots.svelte
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6 }}>
      {[0, 0.1, 0.2].map((delay) => (
        <span
          key={delay}
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--accent-foreground, var(--foreground))',
            opacity: 0.6,
            animation: `lh-bounce 0.75s ease-in-out ${String(delay)}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// Inject keyframes once. `lh-blink` was already present from earlier work;
// `lh-bounce` is new for the thinking-dots animation.
if (typeof document !== 'undefined' && !document.getElementById('lh-chat-anim')) {
  const style = document.createElement('style');
  style.id = 'lh-chat-anim';
  style.textContent = `
    @keyframes lh-blink { 0%, 100% { opacity: 0.85; } 50% { opacity: 0.15; } }
    @keyframes lh-bounce {
      0%, 100% { transform: translateY(0); opacity: 0.4; }
      50% { transform: translateY(-6px); opacity: 0.9; }
    }
  `;
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
        padding: '4px 10px',
        border: '1px solid var(--border)',
        borderRadius: 999,
        background: active ? 'color-mix(in srgb, var(--accent) 70%, transparent)' : 'transparent',
        color: active
          ? 'var(--primary)'
          : disabled
            ? 'color-mix(in srgb, var(--muted-foreground) 50%, transparent)'
            : 'var(--muted-foreground)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 11.5,
        fontWeight: 500,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        transition: 'background 120ms',
      }}
    >
      {children}
    </button>
  );
}
