import type { VersionedHash } from '@platform/ports-identity';

import { hash, verify } from '@node-rs/argon2';

// Argon2id parameters per Objective 5 spec.
// These are the starting defaults; each deployment should calibrate
// memory to target ~150-300ms login latency on its server hardware.
const ARGON2_MEMORY_COST = 65536; // 64 MiB
const ARGON2_TIME_COST = 3;
const ARGON2_PARALLELISM = 4;
const CURRENT_VERSION = 1;

const OPTIONS = {
  memoryCost: ARGON2_MEMORY_COST,
  timeCost: ARGON2_TIME_COST,
  parallelism: ARGON2_PARALLELISM,
};

/** Hash a plaintext password and return a VersionedHash for storage. */
export async function hashPassword(password: string): Promise<VersionedHash> {
  const h = await hash(password, OPTIONS);
  return { hash: h, version: CURRENT_VERSION, algorithm: 'argon2id' };
}

/**
 * Verify a plaintext password against a stored VersionedHash.
 * Version dispatch: if a new algorithm or parameters are introduced,
 * add a new version branch here; old hashes remain verifiable.
 */
export async function verifyPassword(password: string, stored: VersionedHash): Promise<boolean> {
  return verify(stored.hash, password);
}

/**
 * Return true if the stored hash was created with outdated parameters
 * and should be re-hashed on next successful login.
 */
export function needsRehash(stored: VersionedHash): boolean {
  return stored.version < CURRENT_VERSION;
}
