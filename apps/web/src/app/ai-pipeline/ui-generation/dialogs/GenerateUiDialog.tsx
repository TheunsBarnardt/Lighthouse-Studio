'use client';

import { Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { ModelPicker } from '@/components/ai/ModelPicker';
import { getDefaultModel } from '@/lib/ai/model-registry';

interface GenerateUiDialogProps {
  open: boolean;
  onClose: () => void;
  onBlock: (blockId: string) => void;
  onReasoning: (text: string) => void;
  onAssistantDelta: (delta: string) => void;
  onDone: (summary: { inserted: number; reasoning: string }) => void;
}

/**
 * Modal that drives the "Generate UI" action.
 *
 * Submits the brief + model to the streaming compose endpoint and forwards
 * each event to callbacks the parent UI generation page uses to:
 *   - insert blocks into the iframe (`onBlock`)
 *   - log reasoning in the design chat (`onReasoning`)
 *   - stream assistant text into the chat (`onAssistantDelta`)
 *
 * Closes automatically on `done` and surfaces a tiny progress indicator in the
 * meantime. Errors halt the stream and show inline.
 */
export function GenerateUiDialog({
  open,
  onClose,
  onBlock,
  onReasoning,
  onAssistantDelta,
  onDone,
}: GenerateUiDialogProps) {
  const [brief, setBrief] = useState('');
  const [modelId, setModelId] = useState<string>(getDefaultModel().id);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insertedCount, setInsertedCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setInsertedCount(0);
      if (typeof window !== 'undefined') {
        const saved = window.localStorage.getItem('lighthouse.lastIntentBrief');
        if (saved && !brief) setBrief(saved);
      }
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    } else if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    // `brief` is intentionally read but not in deps — we only pre-fill on open.
    return undefined;
  }, [open, brief]);

  if (!open) return null;

  async function submit() {
    if (running) return;
    setRunning(true);
    setError(null);
    setInsertedCount(0);

    const abort = new AbortController();
    abortRef.current = abort;

    let reasoning = '';
    let inserted = 0;
    try {
      const res = await fetch('/api/v1/ai-pipeline/ui-generation/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, model: modelId, mode: 'compose' }),
        signal: abort.signal,
      });
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
            if (ev.type === 'reasoning' && typeof ev['text'] === 'string') {
              reasoning = ev['text'];
              onReasoning(reasoning);
            } else if (ev.type === 'text_delta' && typeof ev['delta'] === 'string') {
              onAssistantDelta(ev['delta']);
            } else if (ev.type === 'block_insert' && typeof ev['blockId'] === 'string') {
              onBlock(ev['blockId']);
              inserted += 1;
              setInsertedCount(inserted);
            } else if (ev.type === 'error' && typeof ev['message'] === 'string') {
              setError(ev['message']);
            }
          } catch {
            // skip malformed
          }
        }
      }

      onDone({ inserted, reasoning });
      onClose();
      // Reset after close so the next open is fresh (but keep brief in case
      // they want to refine).
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
        }}
        style={{
          width: '100%',
          maxWidth: 560,
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}
          >
            <Sparkles style={{ width: 16, height: 16, color: 'var(--primary)' }} />
            Generate UI
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--muted-foreground)',
              cursor: running ? 'not-allowed' : 'pointer',
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 500 }}>
            What are you building?
            <textarea
              ref={textareaRef}
              value={brief}
              onChange={(e) => {
                setBrief(e.target.value);
              }}
              placeholder="A CRM for an 8-person sales team. Contacts, deals, simple dashboard…"
              rows={5}
              disabled={running}
              style={{
                width: '100%',
                marginTop: 6,
                padding: '8px 10px',
                border: '1px solid var(--border)',
                borderRadius: 4,
                fontSize: 13,
                fontFamily: 'inherit',
                resize: 'vertical',
                background: 'var(--background)',
                color: 'var(--foreground)',
              }}
            />
          </label>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Model:</span>
            <ModelPicker
              selectedId={modelId}
              onSelect={(id) => {
                setModelId(id);
              }}
            />
          </div>

          {running && (
            <div
              style={{
                padding: '8px 10px',
                background: 'color-mix(in srgb, var(--primary) 8%, transparent)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Sparkles style={{ width: 14, height: 14, color: 'var(--primary)' }} />
              <span>
                Composing… inserted{' '}
                <strong style={{ color: 'var(--primary)' }}>{insertedCount}</strong> blocks
              </span>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '8px 10px',
                background: 'color-mix(in srgb, var(--destructive) 8%, transparent)',
                border: '1px solid var(--destructive)',
                borderRadius: 4,
                fontSize: 12,
                color: 'var(--destructive)',
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            style={{
              padding: '6px 12px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--foreground)',
              fontSize: 12,
              cursor: running ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void submit();
            }}
            disabled={running}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: 'none',
              background: 'var(--primary)',
              color: 'var(--primary-foreground)',
              fontSize: 12,
              fontWeight: 500,
              cursor: running ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Sparkles style={{ width: 12, height: 12 }} />
            {running ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
