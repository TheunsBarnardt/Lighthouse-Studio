import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const pkg = require('../../../../package.json');

/**
 * The platform's current release version, sourced from the root package.json.
 * This is the single source of truth per ADR-0136.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
export const PLATFORM_VERSION: string = pkg.version as string;
