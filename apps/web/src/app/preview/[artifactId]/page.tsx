import { notFound } from 'next/navigation';

import { getOverlay } from '@/lib/visual-edits/overlay-store';

import { isMockArtifactId } from '../mock-components';
import { PreviewClient } from '../preview-client';

/**
 * Standalone preview surface rendered inside the ui-generation iframe.
 *
 * Resolves the artifact id and the saved edit overlay on the server, then
 * delegates to PreviewClient for the interactive bits (block insertion,
 * selection agent, postMessage handling).
 */
export default function PreviewPage({ params }: { params: { artifactId: string } }) {
  const { artifactId } = params;

  if (!isMockArtifactId(artifactId)) {
    notFound();
  }

  const overlay = getOverlay(artifactId);

  return <PreviewClient artifactId={artifactId} initialOverlay={overlay} />;
}
