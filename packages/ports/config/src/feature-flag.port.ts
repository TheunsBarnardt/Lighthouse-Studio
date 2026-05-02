import type { Result } from 'neverthrow';

import type { ConfigError } from './errors.js';
import type { FeatureFlag, FeatureFlagContext } from './types.js';

export interface FeatureFlagPort {
  isEnabled(key: string, context?: FeatureFlagContext): Promise<Result<boolean, ConfigError>>;
  get<T = unknown>(key: string, context?: FeatureFlagContext): Promise<Result<T, ConfigError>>;
  list(): Promise<Result<FeatureFlag[], ConfigError>>;
  set(flag: FeatureFlag): Promise<Result<void, ConfigError>>;
}
