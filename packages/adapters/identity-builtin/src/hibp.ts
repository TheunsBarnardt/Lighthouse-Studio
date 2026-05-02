import { createHash } from 'node:crypto';

/**
 * Check a password against the HaveIBeenPwned k-anonymity API.
 * Sends only the first 5 hex characters of the SHA-1 hash; the response
 * contains hash suffixes for all matching entries. The full hash never
 * leaves this process.
 *
 * Returns true if the password appears in a known breach.
 * On network error, returns false (fail open) to avoid blocking signups.
 * The check is disabled when HIBP_CHECK_ENABLED=false.
 */
export async function isPwnedPassword(password: string): Promise<boolean> {
  const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) return false;

    const text = await res.text();
    return text.split('\r\n').some((line) => {
      const [lineSuffix] = line.split(':');
      return lineSuffix?.toUpperCase() === suffix;
    });
  } catch {
    return false;
  }
}

/** Minimum password length per Objective 5 spec. */
export const MIN_PASSWORD_LENGTH = 12;

export function validatePasswordLength(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}
