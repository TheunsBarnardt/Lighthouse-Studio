import { notFound } from 'next/navigation';

import { getBlock } from '@/lib/blocks/registry';

import { SelectionAgent } from '../../selection-agent';

/**
 * Preview iframe target for a single block from the global Blocks Library.
 *
 * Mirrors `/preview/[artifactId]` but renders one of the catalog entries from
 * `lib/blocks/registry`. The same SelectionAgent works against blocks because
 * each block tags its elements with `data-edit-id` exactly the same way mock
 * components do.
 */
export default function BlockPreviewPage({ params }: { params: { blockId: string } }) {
  const block = getBlock(params.blockId);
  if (!block) notFound();

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--background, #fff)',
        color: 'var(--foreground, #000)',
      }}
    >
      {block.render()}
      <SelectionAgent initialOverlay={{}} />
    </div>
  );
}
