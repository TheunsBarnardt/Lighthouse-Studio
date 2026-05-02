import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns a base64url-encoded string containing:
 *   [12-byte IV] [16-byte auth tag] [ciphertext]
 *
 * The key must be 32 bytes (256 bits), hex-encoded.
 */
export function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString('base64url');
}

/**
 * Decrypt a value previously encrypted with `encrypt()`.
 * Throws if the ciphertext is tampered or the key is wrong.
 */
export function decrypt(encoded: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  const buf = Buffer.from(encoded, 'base64url');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ct = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/**
 * Generate a new random 256-bit key, hex-encoded.
 * Use this during installation to generate the MFA encryption key.
 */
export function generateKey(): string {
  return randomBytes(32).toString('hex');
}
