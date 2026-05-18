'use client';

import { useEffect, useRef, useState } from 'react';

import {
  applyMutationToElement,
  applyOverlay,
  type EditOverlay,
} from '@/lib/visual-edits/edit-overlay';

import {
  envelope,
  isPreviewEnvelope,
  type PreviewEventIn,
  type SerializedComputedStyle,
} from './protocol';

/**
 * Client-side script that lives inside the preview iframe.
 *
 * Responsibilities:
 *   - Forward hover / click on `[data-edit-id]` elements to the parent.
 *   - Render the hover + selection overlay rectangles.
 *   - Apply optimistic edit mutations received from the parent.
 *   - Apply the saved overlay on mount.
 *
 * Origin check on every inbound message — same-origin only.
 */
export function SelectionAgent({ initialOverlay }: { initialOverlay: EditOverlay }) {
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRect, setSelectedRect] = useState<DOMRect | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Apply initial overlay once the surrounding content has mounted.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    applyOverlay(document.body, initialOverlay);
  }, [initialOverlay]);

  // Announce ready to parent.
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return;
    window.parent.postMessage(envelope({ type: 'ready' }), window.location.origin);
  }, []);

  // Hover + click listeners.
  useEffect(() => {
    if (typeof document === 'undefined') return;

    function findTaggedAncestor(target: EventTarget | null): HTMLElement | null {
      let el = target instanceof HTMLElement ? target : null;
      while (el) {
        if (el.hasAttribute('data-edit-id')) return el;
        el = el.parentElement;
      }
      return null;
    }

    function postOut(payload: Parameters<typeof envelope>[0]) {
      if (window.parent === window) return;
      window.parent.postMessage(envelope(payload), window.location.origin);
    }

    function onMove(ev: MouseEvent) {
      const el = findTaggedAncestor(ev.target);
      if (!el) {
        setHoverRect(null);
        return;
      }
      // Don't draw hover over the currently-selected element.
      if (el.dataset.editId === selectedId) {
        setHoverRect(null);
        return;
      }
      const rect = el.getBoundingClientRect();
      setHoverRect(rect);
      postOut({
        type: 'hover',
        editId: el.dataset.editId ?? '',
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      });
    }

    function onLeave() {
      setHoverRect(null);
    }

    function onClick(ev: MouseEvent) {
      const el = findTaggedAncestor(ev.target);
      if (!el) {
        setSelectedId(null);
        setSelectedRect(null);
        postOut({ type: 'deselect' });
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const computedStyle: SerializedComputedStyle = {
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        padding: cs.padding,
        margin: cs.margin,
        borderRadius: cs.borderRadius,
      };
      setSelectedId(el.dataset.editId ?? null);
      setSelectedRect(rect);
      setHoverRect(null);
      postOut({
        type: 'select',
        editId: el.dataset.editId ?? '',
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        tagName: el.tagName.toLowerCase(),
        className: el.className,
        textContent: el.textContent ?? '',
        computedStyle,
      });
    }

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseleave', onLeave, true);
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseleave', onLeave, true);
      document.removeEventListener('click', onClick, true);
    };
  }, [selectedId]);

  // Inbound messages from the parent.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!isPreviewEnvelope(event.data)) return;
      const payload = event.data.payload as PreviewEventIn;
      switch (payload.type) {
        case 'apply-edit': {
          const el = document.querySelector<HTMLElement>(
            `[data-edit-id="${payload.editId.replace(/["\\]/g, '\\$&')}"]`,
          );
          if (el) {
            applyMutationToElement(el, payload.edit);
            // Update the selection overlay rect since size may have changed.
            if (payload.editId === selectedId) {
              setSelectedRect(el.getBoundingClientRect());
            }
          }
          break;
        }
        case 'reset-edits': {
          // v1 has no client-side history; parent will reload the iframe instead.
          break;
        }
        case 'highlight': {
          if (payload.editId === null) {
            setSelectedId(null);
            setSelectedRect(null);
            break;
          }
          const el = document.querySelector<HTMLElement>(
            `[data-edit-id="${payload.editId.replace(/["\\]/g, '\\$&')}"]`,
          );
          if (el) {
            setSelectedId(payload.editId);
            setSelectedRect(el.getBoundingClientRect());
          }
          break;
        }
        case 'set-overlay': {
          applyOverlay(document.body, payload.overlay);
          break;
        }
      }
    }
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
    };
  }, [selectedId]);

  return (
    <div
      ref={containerRef}
      aria-hidden
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 999999 }}
    >
      {hoverRect && <Outline rect={hoverRect} variant="hover" />}
      {selectedRect && <Outline rect={selectedRect} variant="selected" />}
    </div>
  );
}

function Outline({
  rect,
  variant,
}: {
  rect: { top: number; left: number; width: number; height: number };
  variant: 'hover' | 'selected';
}) {
  const isSelected = variant === 'selected';
  return (
    <div
      style={{
        position: 'absolute',
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        border: isSelected ? '2px solid oklch(0.65 0.18 245)' : '1.5px dashed oklch(0.55 0.16 245)',
        background: isSelected
          ? 'color-mix(in srgb, oklch(0.65 0.18 245) 8%, transparent)'
          : 'transparent',
        borderRadius: 2,
        boxSizing: 'border-box',
        transition: 'top 60ms linear, left 60ms linear, width 60ms linear, height 60ms linear',
      }}
    />
  );
}
