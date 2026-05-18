'use client';

import { useEffect, useRef, useState } from 'react';

import {
  envelope,
  isPreviewEnvelope,
  type EditMutation,
  type PreviewEventOut,
  type SerializedComputedStyle,
  type SerializedRect,
} from '@/app/preview/protocol';

export interface SelectedElement {
  editId: string;
  rect: SerializedRect;
  tagName: string;
  className: string;
  textContent: string;
  computedStyle: SerializedComputedStyle;
}

interface PreviewIframePanelProps {
  artifactId: string;
  /** Notifies parent when iframe selection changes. */
  onSelectionChange: (sel: SelectedElement | null) => void;
  /** Bumped to force iframe reload (e.g. after Save). */
  reloadKey: number;
  /** Imperative handle to push edits into the iframe. */
  applyEditRef: React.MutableRefObject<((editId: string, edit: EditMutation) => void) | null>;
  /** Imperative handle to insert a block from the Blocks Library into the preview. */
  insertBlockRef: React.MutableRefObject<((blockId: string) => void) | null>;
}

type Viewport = 'desktop' | 'mobile';

const VIEWPORT_WIDTH: Record<Viewport, number> = {
  desktop: 1024,
  mobile: 390,
};

export function PreviewIframePanel({
  artifactId,
  onSelectionChange,
  reloadKey,
  applyEditRef,
  insertBlockRef,
}: PreviewIframePanelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [ready, setReady] = useState(false);

  // Listen for messages from the iframe.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!isPreviewEnvelope(event.data)) return;
      const payload = event.data.payload as PreviewEventOut;
      switch (payload.type) {
        case 'ready':
          setReady(true);
          break;
        case 'select':
          onSelectionChange({
            editId: payload.editId,
            rect: payload.rect,
            tagName: payload.tagName,
            className: payload.className,
            textContent: payload.textContent,
            computedStyle: payload.computedStyle,
          });
          break;
        case 'deselect':
          onSelectionChange(null);
          break;
        case 'hover':
          // Hover state is rendered inside the iframe itself; nothing to do here.
          break;
      }
    }
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, [onSelectionChange]);

  // Reset ready flag on reload/artifact change so callers can wait again if needed.
  useEffect(() => {
    setReady(false);
  }, [artifactId, reloadKey]);

  // Wire up the imperative apply-edit handle.
  useEffect(() => {
    applyEditRef.current = (editId: string, edit: EditMutation) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      win.postMessage(envelope({ type: 'apply-edit', editId, edit }), window.location.origin);
    };
    return () => {
      applyEditRef.current = null;
    };
  }, [applyEditRef]);

  // Wire up the imperative insert-block handle.
  useEffect(() => {
    insertBlockRef.current = (blockId: string) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      win.postMessage(envelope({ type: 'insert-block', blockId }), window.location.origin);
    };
    return () => {
      insertBlockRef.current = null;
    };
  }, [insertBlockRef]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--muted)',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)' }}>
          {ready ? 'Live preview · click to edit' : 'Loading preview…'}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['desktop', 'mobile'] as Viewport[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setViewport(v);
              }}
              style={{
                fontSize: 11,
                padding: '2px 8px',
                border: '1px solid var(--border)',
                borderRadius: 3,
                background: viewport === v ? 'var(--accent)' : 'transparent',
                color: viewport === v ? 'var(--primary)' : 'var(--muted-foreground)',
                cursor: 'pointer',
              }}
            >
              {v === 'desktop' ? 'Desktop' : 'Mobile'}
            </button>
          ))}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          background: 'var(--muted)',
          display: 'flex',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <iframe
          ref={iframeRef}
          key={`${artifactId}-${String(reloadKey)}`}
          src={`/preview/${encodeURIComponent(artifactId)}`}
          title={`Preview of ${artifactId}`}
          sandbox="allow-scripts allow-same-origin"
          onDragOver={(e) => {
            // Allow drops from the BlocksPanel inside the same document.
            if (e.dataTransfer.types.includes('application/x-lighthouse-block-id')) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }
          }}
          onDrop={(e) => {
            const blockId = e.dataTransfer.getData('application/x-lighthouse-block-id');
            if (!blockId) return;
            e.preventDefault();
            insertBlockRef.current?.(blockId);
          }}
          style={{
            width: VIEWPORT_WIDTH[viewport],
            maxWidth: '100%',
            height: '100%',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--background)',
            transition: 'width 150ms ease',
          }}
        />
      </div>
    </div>
  );
}
