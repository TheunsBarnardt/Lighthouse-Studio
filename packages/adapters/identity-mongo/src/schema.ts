import type { Db } from 'mongodb';

/**
 * Ensures all required indexes exist for the identity collections.
 * Idempotent — safe to call on every startup.
 */
export async function ensureIdentityIndexes(db: Db): Promise<void> {
  // identity_users: unique non-archived email
  await db.collection('identity_users').createIndexes([
    { key: { primary_email: 1 }, name: 'identity_users_email_idx' },
    {
      key: { 'identities.provider_id': 1, 'identities.subject': 1 },
      name: 'identity_users_identity_uq',
      unique: true,
      sparse: true,
    },
  ]);

  // identity_credentials: _id is user_id (unique by default)

  // identity_sessions: unique token_hash; index on user_id and expires_at
  await db.collection('identity_sessions').createIndexes([
    { key: { token_hash: 1 }, name: 'identity_sessions_token_hash_uq', unique: true },
    { key: { user_id: 1 }, name: 'identity_sessions_user_id_idx' },
    {
      key: { expires_at: 1 },
      name: 'identity_sessions_expires_at_idx',
      expireAfterSeconds: 0,
    },
  ]);
}
