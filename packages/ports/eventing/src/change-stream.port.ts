import type { ChangeEvent, ChangeStreamFeature, WatchOptions } from './types.js';

export interface ChangeStreamPort {
  watch(opts: WatchOptions): AsyncIterable<ChangeEvent>;
  supports(feature: ChangeStreamFeature): boolean;
}
