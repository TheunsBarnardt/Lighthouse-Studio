import path from 'node:path';

/** Converts a platform-native path to POSIX format (forward slashes). Use for storage keys, URLs, and cross-platform comparisons. */
export function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

/** Converts a POSIX path to the current platform's native format. Use before filesystem operations. */
export function fromPosix(p: string): string {
  return p.split('/').join(path.sep);
}

/** Platform-aware absolute path check. */
export function isAbsolute(p: string): boolean {
  return path.isAbsolute(p);
}

/** Joins path segments using the platform-native separator. */
export function join(...segments: string[]): string {
  return path.join(...segments);
}

/** Joins path segments and normalises to POSIX. Useful for storage keys. */
export function joinPosix(...segments: string[]): string {
  return toPosix(path.join(...segments));
}
