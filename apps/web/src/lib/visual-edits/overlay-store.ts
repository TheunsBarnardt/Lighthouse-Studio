/**
 * In-memory overlay store keyed by artifactId.
 *
 * v1: server-side module-level Map. Survives within a single Next.js server
 * process but resets on restart. Good enough to demo persistence end-to-end
 * across iframe reloads in dev.
 *
 * v2: persist overlays to the UI artifact JSON column once Stage 6 artifacts
 * are real (Objective 26 §6.2).
 */

import type { EditOverlay } from './edit-overlay';

const store: Map<string, EditOverlay> = new Map();

export function getOverlay(artifactId: string): EditOverlay {
  return store.get(artifactId) ?? {};
}

export function setOverlay(artifactId: string, overlay: EditOverlay): void {
  store.set(artifactId, overlay);
}

export function clearOverlay(artifactId: string): void {
  store.delete(artifactId);
}
