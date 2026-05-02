import { describe, expect, it } from 'vitest';

import { hashPassword, needsRehash, verifyPassword } from '../src/index.js';

describe('password', () => {
  it('hashPassword + verifyPassword round-trips correctly', async () => {
    const hash = await hashPassword('CorrectHorseBatteryStaple1!');
    const valid = await verifyPassword('CorrectHorseBatteryStaple1!', hash);
    expect(valid).toBe(true);
  });

  it('verifyPassword rejects a wrong password', async () => {
    const hash = await hashPassword('CorrectHorseBatteryStaple1!');
    const invalid = await verifyPassword('WrongPassword123', hash);
    expect(invalid).toBe(false);
  });

  it('needsRehash returns false for current-version hashes', async () => {
    const hash = await hashPassword('CorrectHorseBatteryStaple1!');
    expect(needsRehash(hash)).toBe(false);
  });

  it('needsRehash returns true for outdated hashes', () => {
    expect(needsRehash({ hash: '$argon2id$...', version: 0, algorithm: 'argon2id' })).toBe(true);
  });
});
