import { describe, expect, it } from 'vitest';

import { decrypt, encrypt, generateKey } from '../src/index.js';

describe('crypto', () => {
  it('encrypt + decrypt round-trips a string', () => {
    const key = generateKey();
    const plaintext = 'JBSWY3DPEHPK3PXP'; // typical base32 TOTP secret
    const ciphertext = encrypt(plaintext, key);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext, key)).toBe(plaintext);
  });

  it('each encryption produces a different ciphertext (random IV)', () => {
    const key = generateKey();
    const ct1 = encrypt('same-plaintext', key);
    const ct2 = encrypt('same-plaintext', key);
    expect(ct1).not.toBe(ct2);
  });

  it('decrypt throws on tampered ciphertext', () => {
    const key = generateKey();
    const ct = encrypt('secret', key);
    // Flip a character near the middle
    const tampered = ct.slice(0, ct.length / 2) + 'X' + ct.slice(ct.length / 2 + 1);
    expect(() => decrypt(tampered, key)).toThrow();
  });

  it('generateKey produces a 64-character hex string (32 bytes)', () => {
    const key = generateKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});
