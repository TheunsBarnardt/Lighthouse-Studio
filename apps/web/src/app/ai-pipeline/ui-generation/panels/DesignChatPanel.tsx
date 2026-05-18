'use client';

import { Send, Wrench } from 'lucide-react';
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
  /** Most recent visual edits applied by the user, surfaced as system turns. */
  recentEdits?: { kind: 'edited' | 'inserted' | 'removed'; target: string }[];
  /** Called once per block the assistant decides to insert. */
  onAssistantBlockInsert?: (blockId: string) => void;
}

/**
 * Chat-with-AI panel for UI generation.
 *
 * v1 (this PR) is a skeleton: it renders the Lovable-style turn list, accepts
 * input, shows the model picker, and echoes the user's last message back as a
 * mock assistant turn. There is no real AI wiring yet — that lands when the
 * `composeUi` prompt + per-element "Ask AI to modify" backend ship (see
 * Objective 26 §0 capability 4).
 *
 * What this panel intentionally already does correctly:
 *   - Model selection is persisted to `localStorage.lighthouse.designChatModelId`
 *     (separate from intent-capture's model key so the two surfaces can diverge).
 *   - The "recent edits" prop lets the chat list show what visual changes the
 *     user has applied between AI turns, matching Lovable's UX where the chat
 *     thread shows both AI actions and manual ones.
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
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('lighthouse.designChatModelId', modelId);
    }
  }, [modelId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length, recentEdits?.length]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || busy) return;
    const userTurn: ChatTurn = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    };
    const assistantId = crypto.randomUUID();
    const assistantTurn: ChatTurn = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
    };
    setTurns((prev) => [...prev, userTurn, assistantTurn]);
    setInput('');
    setBusy(true);

    try {
      const res = await fetch('/api/v1/ai-pipeline/ui-generation/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: trimmed, model: modelId, mode: 'modify' }),
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
              // Reasoning is appended discreetly under the response.
              const note = `\n\n_${ev['text']}_`;
              assistantText += note;
              const snapshot = assistantText;
              setTurns((prev) =>
                prev.map((t) => (t.id === assistantId ? { ...t, content: snapshot } : t)),
              );
            }
          } catch {
            // skip
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
        }}
      >
        <span>Design chat</span>
        <span
          style={{
            fontSize: 9,
            padding: '1px 6px',
            borderRadius: 999,
            background: 'color-mix(in srgb, var(--primary) 14%, transparent)',
            color: 'var(--primary)',
            fontWeight: 600,
            letterSpacing: 0,
          }}
        >
          PREVIEW
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {turns.length === 0 && (!recentEdits || recentEdits.length === 0) && (
          <div
            style={{
              padding: 16,
              fontSize: 11,
              color: 'var(--muted-foreground)',
              textAlign: 'center',
            }}
          >
            Ask the AI to change the design, or pick blocks / edit elements directly.
          </div>
        )}
        {recentEdits?.map((e, i) => (
          <SystemEvent key={`e-${String(i)}`} kind={e.kind} target={e.target} />
        ))}
        {turns.map((t) => (
          <Turn key={t.id} turn={t} />
        ))}
        <div ref={endRef} />
      </div>

      <div
        style={{
          padding: 8,
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <textarea
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
            padding: '6px 8px',
            borderRadius: 4,
            border: '1px solid var(--border)',
            fontSize: 12,
            resize: 'none',
            fontFamily: 'inherit',
            background: 'var(--background)',
            color: 'var(--foreground)',
          }}
        />
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
        >
          <ModelPicker
            selectedId={modelId}
            onSelect={(id) => {
              setModelId(id);
            }}
          />
          <button
            type="button"
            onClick={() => {
              void send();
            }}
            disabled={!input.trim() || busy}
            style={{
              padding: '5px 10px',
              borderRadius: 4,
              border: 'none',
              background: input.trim() && !busy ? 'var(--primary)' : 'var(--muted)',
              color:
                input.trim() && !busy ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
              fontSize: 12,
              cursor: input.trim() && !busy ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Send style={{ width: 12, height: 12 }} /> Ask
          </button>
        </div>
      </div>
    </div>
  );
}

function Turn({ turn }: { turn: ChatTurn }) {
  const isUser = turn.role === 'user';
  return (
    <div
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '92%',
        background: isUser ? 'var(--accent)' : 'transparent',
        color: 'var(--foreground)',
        borderRadius: 10,
        padding: isUser ? '6px 10px' : '4px 2px',
        fontSize: 12,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        border: isUser ? '1px solid color-mix(in srgb, var(--primary) 14%, transparent)' : 'none',
      }}
    >
      {!isUser && (
        <div
          style={{
            fontSize: 9,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--muted-foreground)',
            marginBottom: 2,
            fontWeight: 600,
          }}
        >
          AI
        </div>
      )}
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
