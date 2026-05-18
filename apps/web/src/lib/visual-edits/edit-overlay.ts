/**
 * Edit overlay — the v1 stand-in for AST-level source mutation.
 *
 * An overlay maps `editId` → `EditMutation`. When the preview iframe renders,
 * it walks the DOM after mount and applies overlay mutations on top of the
 * base render. This gives the visual-edits UX end-to-end without needing real
 * generated source files to exist yet.
 *
 * When real artifact generation lands (Objective 26 §6.6), overlays are still
 * useful as a buffer between optimistic edits and the AST round-trip — but the
 * persistence backend swaps to actual source mutation.
 */

import type { EditMutation } from '@/app/preview/protocol';

export type EditOverlay = Record<string, EditMutation>;

/** Apply a single mutation to a live DOM element. Pure-ish — mutates the element. */
export function applyMutationToElement(el: HTMLElement, mutation: EditMutation): void {
  if (typeof mutation.text === 'string') {
    el.textContent = mutation.text;
  }
  if (typeof mutation.setClass === 'string') {
    el.className = mutation.setClass;
  }
  if (mutation.removeClass) {
    for (const cls of mutation.removeClass) {
      if (cls) el.classList.remove(cls);
    }
  }
  if (mutation.addClass) {
    for (const cls of mutation.addClass) {
      if (cls) el.classList.add(cls);
    }
  }
}

/** Apply every mutation in an overlay to whatever elements exist in `root`. */
export function applyOverlay(root: ParentNode, overlay: EditOverlay): void {
  for (const [editId, mutation] of Object.entries(overlay)) {
    const el = root.querySelector<HTMLElement>(`[data-edit-id="${cssEscape(editId)}"]`);
    if (el) applyMutationToElement(el, mutation);
  }
}

/** Merge a new mutation into an existing overlay. Add/remove class lists union. */
export function mergeMutation(
  overlay: EditOverlay,
  editId: string,
  next: EditMutation,
): EditOverlay {
  const prev = overlay[editId] ?? {};
  const merged: EditMutation = { ...prev };
  if (typeof next.text === 'string') merged.text = next.text;
  if (typeof next.setClass === 'string') {
    merged.setClass = next.setClass;
    delete merged.addClass;
    delete merged.removeClass;
  }
  if (next.addClass) {
    const set = new Set([...(merged.addClass ?? []), ...next.addClass]);
    merged.addClass = [...set];
    if (merged.removeClass) {
      merged.removeClass = merged.removeClass.filter((c) => !set.has(c));
    }
  }
  if (next.removeClass) {
    const set = new Set([...(merged.removeClass ?? []), ...next.removeClass]);
    merged.removeClass = [...set];
    if (merged.addClass) {
      merged.addClass = merged.addClass.filter((c) => !set.has(c));
    }
  }
  return { ...overlay, [editId]: merged };
}

/**
 * Minimal CSS.escape fallback for attribute-selector use. Most edit IDs are
 * `Word.word[index]` style so we just guard the characters that break the
 * `[data-edit-id="..."]` selector when present in IDs.
 */
function cssEscape(value: string): string {
  return value.replace(/["\\]/g, (m) => `\\${m}`);
}
