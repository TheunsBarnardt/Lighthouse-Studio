import type {
  FullTextSearchOptions,
  FullTextSearchPort,
  SearchError,
  SearchResult,
} from '@platform/ports-search';
import type { Result } from 'neverthrow';

import { ok } from 'neverthrow';

export class InMemoryFullTextSearch implements FullTextSearchPort {
  private readonly indexes = new Map<string, Map<string, Record<string, unknown>>>();

  private getIndex(name: string): Map<string, Record<string, unknown>> {
    let idx = this.indexes.get(name);
    if (!idx) {
      idx = new Map();
      this.indexes.set(name, idx);
    }
    return idx;
  }

  index(
    indexName: string,
    id: string,
    document: Record<string, unknown>,
  ): Promise<Result<void, SearchError>> {
    this.getIndex(indexName).set(id, { ...document, id });
    return Promise.resolve(ok(undefined));
  }

  delete(indexName: string, id: string): Promise<Result<void, SearchError>> {
    this.getIndex(indexName).delete(id);
    return Promise.resolve(ok(undefined));
  }

  search<T extends Record<string, unknown>>(
    indexName: string,
    query: string,
    opts?: FullTextSearchOptions,
  ): Promise<Result<SearchResult<T>, SearchError>> {
    const idx = this.getIndex(indexName);
    const lq = query.toLowerCase();
    const limit = opts?.limit ?? 10;
    const offset = opts?.offset ?? 0;
    const allMatches: Array<T & { _score: number }> = [];
    for (const doc of idx.values()) {
      const text = Object.values(doc).join(' ').toLowerCase();
      if (text.includes(lq)) {
        allMatches.push({ ...doc, _score: 1.0 } as T & { _score: number });
      }
    }
    const items = allMatches.slice(offset, offset + limit);
    return Promise.resolve(ok({ items, total: allMatches.length, took: 0 }));
  }

  deleteIndex(indexName: string): Promise<Result<void, SearchError>> {
    this.indexes.delete(indexName);
    return Promise.resolve(ok(undefined));
  }
}
