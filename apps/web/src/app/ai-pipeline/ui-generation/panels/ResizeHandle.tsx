'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface ResizeHandleProps {
  /** Which side of the parent column this handle controls. */
  side: 'right' | 'left';
  /** Called continuously during drag with the new width in px. */
  onResize: (width: number) => void;
  /** Initial width to anchor the drag against. */
  startWidth: number;
  /** Hard limits. */
  min?: number;
  max?: number;
}

/**
 * Thin vertical drag bar used between resizable columns in the UI generation
 * page. 4 px wide, transparent, becomes a primary-tinted strip on hover/drag.
 *
 * `side: 'right'` — handle sits on the right edge of the column it controls,
 * dragging right grows the column. `side: 'left'` is the mirror image.
 */
export function ResizeHandle({
  side,
  onResize,
  startWidth,
  min = 200,
  max = 800,
}: ResizeHandleProps) {
  const [active, setActive] = useState(false);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(startWidth);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      draggingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = startWidth;
      setActive(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [startWidth],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      const delta = e.clientX - startXRef.current;
      const signed = side === 'right' ? delta : -delta;
      const next = Math.max(min, Math.min(max, startWidthRef.current + signed));
      onResize(next);
    },
    [side, onResize, min, max],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    setActive(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // pointer may already be released
    }
  }, []);

  // Reset transient body styles if the component unmounts mid-drag.
  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        [side === 'right' ? 'right' : 'left']: -3,
        width: 6,
        cursor: 'col-resize',
        zIndex: 20,
        touchAction: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 2,
          width: 2,
          background: active ? 'var(--primary)' : 'transparent',
          transition: 'background 120ms',
        }}
      />
    </div>
  );
}
