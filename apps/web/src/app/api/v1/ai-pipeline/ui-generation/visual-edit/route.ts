import { NextResponse } from 'next/server';

import type { EditMutation } from '@/app/preview/protocol';

import { mergeMutation, type EditOverlay } from '@/lib/visual-edits/edit-overlay';
import { getOverlay, setOverlay } from '@/lib/visual-edits/overlay-store';

interface SaveRequest {
  artifactId: string;
  edits: Record<string, EditMutation>;
}

/**
 * POST /api/v1/ai-pipeline/ui-generation/visual-edit
 *
 * Merges the supplied edits into the in-memory overlay store keyed by artifact.
 * On next iframe reload, `/preview/[artifactId]/page.tsx` reads the overlay and
 * applies it via the SelectionAgent's mount-time pass.
 *
 * v1: in-memory only — see overlay-store.ts. v2 persists to the UI artifact.
 */
export async function POST(request: Request) {
  let body: SaveRequest;
  try {
    body = (await request.json()) as SaveRequest;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (typeof body.artifactId !== 'string' || !body.artifactId) {
    return NextResponse.json({ error: 'artifactId_required' }, { status: 400 });
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (typeof body.edits !== 'object' || body.edits === null) {
    return NextResponse.json({ error: 'edits_required' }, { status: 400 });
  }

  let overlay: EditOverlay = getOverlay(body.artifactId);
  for (const [editId, mutation] of Object.entries(body.edits)) {
    overlay = mergeMutation(overlay, editId, mutation);
  }
  setOverlay(body.artifactId, overlay);

  return NextResponse.json({ ok: true, overlay });
}

export function GET(request: Request) {
  const url = new URL(request.url);
  const artifactId = url.searchParams.get('artifactId');
  if (!artifactId) {
    return NextResponse.json({ error: 'artifactId_required' }, { status: 400 });
  }
  return NextResponse.json({ overlay: getOverlay(artifactId) });
}
