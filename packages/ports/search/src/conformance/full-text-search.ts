import { describe, expect, it } from 'vitest';

import type { FullTextSearchPort } from '../full-text-search.port.js';

export function runFullTextSearchConformance(
  name: string,
  factory: () => Promise<FullTextSearchPort>,
): void {
  describe(`${name} — FullTextSearchPort conformance`, () => {
    const indexName = `conformance-${String(Date.now())}`;

    it('index then search finds the document', async () => {
      const search = await factory();
      await search.index(indexName, 'doc-1', {
        title: 'Lighthouse Studio',
        body: 'A platform for building AI apps',
      });
      const result = await search.search(indexName, 'Lighthouse');
      expect(result.isOk()).toBe(true);
      const items = result._unsafeUnwrap().items;
      expect(items.length).toBeGreaterThan(0);
      expect(items[0]?._score).toBeGreaterThan(0);
    });

    it('delete removes the document from the index', async () => {
      const search = await factory();
      const idx = `del-${String(Date.now())}`;
      await search.index(idx, 'to-delete', { title: 'delete me' });
      await search.delete(idx, 'to-delete');
      const result = await search.search(idx, 'delete me');
      const items = result._unsafeUnwrap().items;
      expect(
        items.find((i) => (i as Record<string, unknown>)['id'] === 'to-delete'),
      ).toBeUndefined();
    });
  });
}
