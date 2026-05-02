import { createHmac, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32; // 256 bits

/**
 * Generate a cryptographically random opaque token (base64url, 256 bits).
 * This is the value sent to the client; it must not be stored as-is.
 */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/**
 * Derive a deterministic HMAC-SHA256 hash of a token, suitable for
 * storage and lookup. The secret key prevents offline dictionary attacks
 * against the stored hashes.
 */
export function hashToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

/** Standard TTLs (in milliseconds). */
export const TTL = {
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1_000, // 24 hours
  PASSWORD_RESET: 60 * 60 * 1_000, // 1 hour
  MAGIC_LINK: 15 * 60 * 1_000, // 15 minutes
  OAUTH_STATE: 10 * 60 * 1_000, // 10 minutes
} as const;

/** Return a Date representing `now + ttlMs`. */
export function expiresAt(ttlMs: number): Date {
  return new Date(Date.now() + ttlMs);
}
