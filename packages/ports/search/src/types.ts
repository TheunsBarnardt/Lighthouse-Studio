import { z } from 'zod';

export interface SearchResult<T> {
  items: Array<T & { _score: number }>;
  total: number;
  took: number;
}

export interface VectorSearchResult<T> {
  items: Array<T & { _distance: number }>;
  total: number;
}

export interface FullTextSearchOptions {
  fields?: string[];
  limit?: number;
  offset?: number;
  filters?: Record<string, unknown>;
  highlight?: boolean;
}

export interface VectorPoint {
  id: string;
  vector: number[];
  payload?: Record<string, unknown>;
}

export interface VectorSearchOptions {
  limit?: number;
  scoreThreshold?: number;
  filter?: Record<string, unknown>;
}

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
}

export const FullTextSearchOptionsSchema = z.object({
  fields: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().min(0).optional(),
});
