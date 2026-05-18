/**
 * postMessage protocol between the preview iframe (`/preview/[artifactId]`)
 * and the parent ui-generation page.
 *
 * Both sides MUST verify `event.origin === window.location.origin` before
 * processing any message. The iframe runs same-origin and shares the page's
 * cookie/auth surface — origin lockdown is the only safety net.
 */

export interface SerializedRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Read-only computed style fields we forward to the inspector. */
export interface SerializedComputedStyle {
  color: string;
  backgroundColor: string;
  fontSize: string;
  fontWeight: string;
  padding: string;
  margin: string;
  borderRadius: string;
}

/** A single mutation applied to an element identified by `editId`. */
export interface EditMutation {
  text?: string;
  /** Classes to add (Tailwind or arbitrary). */
  addClass?: string[];
  /** Classes to remove. */
  removeClass?: string[];
  /** Replace the entire className string. */
  setClass?: string;
}

/** Events from iframe → parent. */
export type PreviewEventOut =
  | { type: 'ready' }
  | { type: 'hover'; editId: string; rect: SerializedRect }
  | {
      type: 'select';
      editId: string;
      rect: SerializedRect;
      tagName: string;
      className: string;
      textContent: string;
      computedStyle: SerializedComputedStyle;
    }
  | { type: 'deselect' };

/** Events from parent → iframe. */
export type PreviewEventIn =
  | { type: 'highlight'; editId: string | null }
  | { type: 'apply-edit'; editId: string; edit: EditMutation }
  | { type: 'reset-edits' }
  | { type: 'set-overlay'; overlay: Record<string, EditMutation> }
  | {
      type: 'insert-block';
      blockId: string;
      anchor?: { editId: string; position: 'before' | 'after' };
    }
  | { type: 'remove-block'; instanceId: string }
  | { type: 'move-block'; instanceId: string; direction: 'up' | 'down' };

export const PREVIEW_PROTOCOL_VERSION = 1 as const;

/** Tagged envelope to disambiguate from other postMessage traffic. */
export interface PreviewEnvelope<T extends PreviewEventIn | PreviewEventOut> {
  source: 'lighthouse-preview';
  version: typeof PREVIEW_PROTOCOL_VERSION;
  payload: T;
}

export function envelope<T extends PreviewEventIn | PreviewEventOut>(
  payload: T,
): PreviewEnvelope<T> {
  return { source: 'lighthouse-preview', version: PREVIEW_PROTOCOL_VERSION, payload };
}

export function isPreviewEnvelope(
  data: unknown,
): data is PreviewEnvelope<PreviewEventIn | PreviewEventOut> {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    d.source === 'lighthouse-preview' &&
    d.version === PREVIEW_PROTOCOL_VERSION &&
    typeof d.payload === 'object' &&
    d.payload !== null
  );
}
