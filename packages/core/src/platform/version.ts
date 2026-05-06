import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function findNearestPackageJson(start: string): { version: string } {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      return JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf-8')) as { version: string };
    } catch {
      const parent = resolve(dir, '..');
      if (parent === dir) break;
      dir = parent;
    }
  }
  return { version: '0.0.0' };
}

/** The platform's current release version, sourced from the nearest package.json. */
export const PLATFORM_VERSION: string = findNearestPackageJson(
  dirname(fileURLToPath(import.meta.url)),
).version;
