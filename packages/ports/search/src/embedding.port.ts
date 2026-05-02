import type { Result } from 'neverthrow';

import type { SearchError } from './errors.js';
import type { EmbeddingOptions } from './types.js';

export interface EmbeddingPort {
  embed(text: string | string[], opts?: EmbeddingOptions): Promise<Result<number[][], SearchError>>;
  dimensions(model?: string): number;
}
