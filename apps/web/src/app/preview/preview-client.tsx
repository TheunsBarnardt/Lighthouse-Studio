'use client';

import { ArrowDown, ArrowUp, GripVertical, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

import type { EditOverlay } from '@/lib/visual-edits/edit-overlay';

import { BLOCKS, getBlock } from '@/lib/blocks/registry';

import { MockComponent, type MockArtifactId } from './mock-components';
import { envelope, isPreviewEnvelope, type PreviewEventIn } from './protocol';
import { SelectionAgent } from './selection-agent';

interface BlockInstance {
  /** Stable per-insertion id, distinct from blockId (you can insert the same block twice). */
  instanceId: string;
  blockId: string;
}

interface PreviewClientProps {
  artifactId: MockArtifactId;
  initialOverlay: EditOverlay;
}

/**
 * Client wrapper around the preview iframe content.
 *
 * Holds the dynamic state that can't be server-rendered:
 *   - inserted blocks (added via parent postMessage from BlocksPanel)
 *   - selection / overlay state (handled inside SelectionAgent)
 *
 * Listens for `insert-block`, `remove-block`, `move-block` envelope messages
 * from the parent (see protocol.ts).
 */
export function PreviewClient({ artifactId, initialOverlay }: PreviewClientProps) {
  const [insertedBlocks, setInsertedBlocks] = useState<BlockInstance[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!isPreviewEnvelope(event.data)) return;
      const payload = event.data.payload as PreviewEventIn;
      if (payload.type === 'insert-block') {
        const block = getBlock(payload.blockId);
        if (!block) return;
        const instance: BlockInstance = {
          instanceId: `block-${block.id}-${Date.now().toString(36)}`,
          blockId: block.id,
        };
        setInsertedBlocks((prev) => [...prev, instance]);
      } else if (payload.type === 'remove-block') {
        setInsertedBlocks((prev) => prev.filter((b) => b.instanceId !== payload.instanceId));
      } else if (payload.type === 'move-block') {
        setInsertedBlocks((prev) => {
          const idx = prev.findIndex((b) => b.instanceId === payload.instanceId);
          if (idx === -1) return prev;
          const target = payload.direction === 'up' ? idx - 1 : idx + 1;
          if (target < 0 || target >= prev.length) return prev;
          const next = [...prev];
          [next[idx], next[target]] = [next[target], next[idx]];
          return next;
        });
      }
    }

    window.addEventListener('message', onMessage);

    function onReorder(event: Event) {
      const detail = (event as CustomEvent<{ dragged: string; target: string }>).detail;
      setInsertedBlocks((prev) => {
        const dragIdx = prev.findIndex((b) => b.instanceId === detail.dragged);
        const dropIdx = prev.findIndex((b) => b.instanceId === detail.target);
        if (dragIdx === -1 || dropIdx === -1 || dragIdx === dropIdx) return prev;
        const next = [...prev];
        // splice always returns the removed element here because dragIdx is in range.
        const moved = next.splice(dragIdx, 1)[0];
        next.splice(dropIdx, 0, moved);
        return next;
      });
    }

    window.addEventListener('lighthouse-reorder', onReorder as EventListener);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('lighthouse-reorder', onReorder as EventListener);
    };
  }, []);

  // Re-announce ready after inserted blocks change so the parent can refresh
  // any state that depends on the document (e.g. recompute selection rects).
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return;
    window.parent.postMessage(envelope({ type: 'ready' }), window.location.origin);
  }, [insertedBlocks.length]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--background, #fff)',
        color: 'var(--foreground, #000)',
        padding: 16,
      }}
    >
      <MockComponent artifactId={artifactId} />
      {insertedBlocks.map((inst, idx) => {
        const block = BLOCKS.find((b) => b.id === inst.blockId);
        if (!block) return null;
        return (
          <BlockInstanceWrapper
            key={inst.instanceId}
            instanceId={inst.instanceId}
            label={block.name}
            isFirst={idx === 0}
            isLast={idx === insertedBlocks.length - 1}
            onRemove={() => {
              setInsertedBlocks((prev) => prev.filter((b) => b.instanceId !== inst.instanceId));
            }}
            onMove={(direction) => {
              setInsertedBlocks((prev) => {
                const i = prev.findIndex((b) => b.instanceId === inst.instanceId);
                if (i === -1) return prev;
                const t = direction === 'up' ? i - 1 : i + 1;
                if (t < 0 || t >= prev.length) return prev;
                const next = [...prev];
                [next[i], next[t]] = [next[t], next[i]];
                return next;
              });
            }}
          >
            {block.render()}
          </BlockInstanceWrapper>
        );
      })}
      <SelectionAgent initialOverlay={initialOverlay} />
    </div>
  );
}

/**
 * Wraps an inserted block with hover-visible reorder controls.
 * Clicking ×/↑/↓ mutates the parent's insertedBlocks state directly via the
 * callbacks (no postMessage round-trip — these controls run inside the iframe
 * which owns the block list).
 */
function BlockInstanceWrapper({
  instanceId,
  label,
  isFirst,
  isLast,
  onRemove,
  onMove,
  children,
}: {
  instanceId: string;
  label: string;
  isFirst: boolean;
  isLast: boolean;
  onRemove: () => void;
  onMove: (direction: 'up' | 'down') => void;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const [draggingOver, setDraggingOver] = useState(false);
  return (
    <div
      data-block-instance={instanceId}
      onMouseEnter={() => {
        setHover(true);
      }}
      onMouseLeave={() => {
        setHover(false);
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/x-lighthouse-block-instance')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDraggingOver(true);
        }
      }}
      onDragLeave={() => {
        setDraggingOver(false);
      }}
      onDrop={(e) => {
        setDraggingOver(false);
        const draggedId = e.dataTransfer.getData('application/x-lighthouse-block-instance');
        if (!draggedId || draggedId === instanceId) return;
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent('lighthouse-reorder', {
            detail: { dragged: draggedId, target: instanceId },
          }),
        );
      }}
      style={{
        position: 'relative',
        marginTop: 16,
        outline: draggingOver
          ? '3px solid oklch(0.55 0.18 145)'
          : hover
            ? '2px dashed oklch(0.65 0.18 245)'
            : 'none',
        outlineOffset: 2,
        borderRadius: 4,
      }}
    >
      {hover && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 6px',
            borderRadius: 6,
            background: 'rgba(15,15,15,0.85)',
            backdropFilter: 'blur(4px)',
            zIndex: 999998,
            pointerEvents: 'auto',
          }}
        >
          <span
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-lighthouse-block-instance', instanceId);
              e.dataTransfer.effectAllowed = 'move';
            }}
            title="Drag to reorder"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 4px',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'grab',
            }}
          >
            <GripVertical style={{ width: 12, height: 12 }} />
          </span>
          <span
            style={{
              fontSize: 10,
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              color: 'rgba(255,255,255,0.85)',
              padding: '0 4px',
              maxWidth: 140,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={label}
          >
            {label}
          </span>
          <BlockButton
            onClick={() => {
              onMove('up');
            }}
            disabled={isFirst}
            title="Move up"
          >
            <ArrowUp style={{ width: 12, height: 12 }} />
          </BlockButton>
          <BlockButton
            onClick={() => {
              onMove('down');
            }}
            disabled={isLast}
            title="Move down"
          >
            <ArrowDown style={{ width: 12, height: 12 }} />
          </BlockButton>
          <BlockButton onClick={onRemove} title="Remove">
            <X style={{ width: 12, height: 12 }} />
          </BlockButton>
        </div>
      )}
      {children}
    </div>
  );
}

function BlockButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      title={title}
      style={{
        background: 'transparent',
        border: 'none',
        padding: 4,
        color: disabled ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.9)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}
