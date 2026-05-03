/**
 * Synthetic data generator for load testing.
 *
 * Generates at the scale specified in Objective 10:
 *   - 10,000 users (identity_users + identity_identities + identity_credentials)
 *   - 100 workspaces (with members and roles)
 *   - 100,000 workspace invitations (proxy for "artifacts" until Obj 11 adds that table)
 *   - 1,000,000 audit events with correct SHA-256 hash chains
 *
 * Usage:
 *   pnpm tsx tests/load/seed/generate.ts [--scale=full|quarter|tenth]
 *
 * The script is idempotent: it checks for load-test-prefixed rows before inserting.
 * Run with --clean to drop existing load-test data first.
 *
 * All load-test users share password: LoadTest1!
 * User emails: load-test-user-NNNNN@loadtest.internal
 */

import { hash as argon2Hash } from '@node-rs/argon2';
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { argv, env } from 'node:process';
import pg from 'pg';

// ── Config ───────────────────────────────────────────────────────────────────

const SCALES = {
  full: {
    users: 10_000,
    workspaces: 100,
    invitationsPerWorkspace: 1_000,
    auditPerWorkspace: 10_000,
  },
  quarter: { users: 2_500, workspaces: 25, invitationsPerWorkspace: 250, auditPerWorkspace: 2_500 },
  tenth: { users: 1_000, workspaces: 10, invitationsPerWorkspace: 100, auditPerWorkspace: 1_000 },
} as const;

const args = argv.slice(2);
const scaleArg = args.find((a) => a.startsWith('--scale='))?.replace('--scale=', '') ?? 'full';
const doClean = args.includes('--clean');
const scale: (typeof SCALES)[keyof typeof SCALES] =
  (SCALES as Record<string, (typeof SCALES)[keyof typeof SCALES] | undefined>)[scaleArg] ??
  SCALES.full;

const LOAD_TEST_PASSWORD = 'LoadTest1!';
const LOAD_TEST_EMAIL_DOMAIN = 'loadtest.internal';
const LOAD_TEST_USER_PREFIX = 'load-test-user-';
const LOAD_TEST_WORKSPACE_PREFIX = 'load-test-ws-';

const GENESIS_HASH = '0'.repeat(64);

const ARGON2_OPTIONS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

// ── DB connection ─────────────────────────────────────────────────────────────

const REQUIRED_ENV = ['DATABASE_URL'] as const;
for (const k of REQUIRED_ENV) {
  if (!env[k]) {
    console.error(`Missing required env var: ${k}`);
    process.exit(1);
  }
}

const pool = new pg.Pool({ connectionString: env['DATABASE_URL']! });

// ── Helpers ───────────────────────────────────────────────────────────────────

function padded(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function computeAuditHash(
  eventType: string,
  workspaceId: string | null,
  actorKind: string,
  actorId: string | null,
  resourceType: string,
  resourceId: string,
  action: string,
  outcome: string,
  correlationId: string,
  sequence: number,
  occurredAtMs: number,
  prevHash: string,
): string {
  const canonical = JSON.stringify({
    eventType,
    workspaceId,
    actorKind,
    actorId,
    resourceType,
    resourceId,
    action,
    outcome,
    correlationId,
    sequence,
    occurredAtMs,
    prevHash,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function tokenHash(token: string): string {
  const secret = env['SESSION_SECRET'] ?? 'load-test-secret';
  return createHmac('sha256', secret).update(token).digest('hex');
}

function progress(msg: string): void {
  process.stdout.write(`\r${msg.padEnd(80)}`);
}

function done(msg: string): void {
  console.log(`\n✓ ${msg}`);
}

// ── Clean ─────────────────────────────────────────────────────────────────────

async function cleanLoadTestData(client: pg.PoolClient): Promise<void> {
  console.log('Cleaning existing load-test data...');

  // Delete in dependency order (FKs)
  await client.query(`DELETE FROM audit_log WHERE workspace_id IN (
    SELECT id FROM workspaces WHERE slug LIKE '${LOAD_TEST_WORKSPACE_PREFIX}%'
  )`);
  await client.query(`DELETE FROM audit_chain_state WHERE workspace_id IN (
    SELECT id FROM workspaces WHERE slug LIKE '${LOAD_TEST_WORKSPACE_PREFIX}%'
  )`);
  await client.query(`DELETE FROM workspace_invitations WHERE workspace_id IN (
    SELECT id FROM workspaces WHERE slug LIKE '${LOAD_TEST_WORKSPACE_PREFIX}%'
  )`);
  await client.query(`DELETE FROM workspace_member_roles WHERE workspace_member_id IN (
    SELECT wm.id FROM workspace_members wm
    JOIN workspaces w ON w.id = wm.workspace_id
    WHERE w.slug LIKE '${LOAD_TEST_WORKSPACE_PREFIX}%'
  )`);
  await client.query(`DELETE FROM workspace_members WHERE workspace_id IN (
    SELECT id FROM workspaces WHERE slug LIKE '${LOAD_TEST_WORKSPACE_PREFIX}%'
  )`);
  await client.query(`DELETE FROM workspaces WHERE slug LIKE '${LOAD_TEST_WORKSPACE_PREFIX}%'`);
  await client.query(
    `DELETE FROM identity_identities WHERE user_id IN (
      SELECT id FROM identity_users WHERE primary_email LIKE '%@${LOAD_TEST_EMAIL_DOMAIN}'
    )`,
  );
  await client.query(
    `DELETE FROM identity_credentials WHERE user_id IN (
      SELECT id FROM identity_users WHERE primary_email LIKE '%@${LOAD_TEST_EMAIL_DOMAIN}'
    )`,
  );
  await client.query(
    `DELETE FROM identity_users WHERE primary_email LIKE '%@${LOAD_TEST_EMAIL_DOMAIN}'`,
  );

  done('Cleaned existing load-test data');
}

// ── Users ─────────────────────────────────────────────────────────────────────

async function generateUsers(client: pg.PoolClient, passwordHash: string): Promise<string[]> {
  const { users: userCount } = scale;
  const userIds: string[] = [];
  const BATCH = 500;

  for (let start = 0; start < userCount; start += BATCH) {
    const end = Math.min(start + BATCH, userCount);
    const userRows: unknown[][] = [];
    const identityRows: unknown[][] = [];
    const credentialRows: unknown[][] = [];

    for (let i = start; i < end; i++) {
      const id = randomUUID();
      const email = `${LOAD_TEST_USER_PREFIX}${padded(i + 1, 5)}@${LOAD_TEST_EMAIL_DOMAIN}`;
      const displayName = `Load Test User ${padded(i + 1, 5)}`;
      // Mix in edge-case data every 100 users
      const isUnicode = i % 100 === 0;
      const hasNullDisplay = i % 200 === 0;
      const now = new Date(Date.now() - Math.floor(Math.random() * 30 * 86400_000)); // up to 30 days ago

      userIds.push(id);
      userRows.push([
        id,
        email,
        true,
        hasNullDisplay ? null : isUnicode ? `Ünïcödé Ûsér ${padded(i + 1, 5)}` : displayName,
        'active',
        false,
        JSON.stringify({ locale: 'en', theme: i % 3 === 0 ? 'dark' : 'light' }),
        now,
        now,
      ]);
      identityRows.push([randomUUID(), id, 'builtin', email, email, true, true, now, null]);
      credentialRows.push([id, passwordHash, 1, 'argon2id', null, null, '{}', 0, null, null]);
    }

    // Batch insert users
    const userPlaceholders = userRows
      .map((_, j) => {
        const base = j * 9;
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9})`;
      })
      .join(',');
    await client.query(
      `INSERT INTO identity_users (id, primary_email, email_verified, display_name, status, mfa_enabled, preferences, created_at, updated_at)
       VALUES ${userPlaceholders}
       ON CONFLICT (primary_email) DO NOTHING`,
      userRows.flat(),
    );

    // Batch insert identities
    const identityPlaceholders = identityRows
      .map((_, j) => {
        const base = j * 9;
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9})`;
      })
      .join(',');
    await client.query(
      `INSERT INTO identity_identities (id, user_id, provider_id, subject, email, email_verified, is_primary, linked_at, last_used_at)
       VALUES ${identityPlaceholders}
       ON CONFLICT DO NOTHING`,
      identityRows.flat(),
    );

    // Batch insert credentials
    const credPlaceholders = credentialRows
      .map((_, j) => {
        const base = j * 10;
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10})`;
      })
      .join(',');
    await client.query(
      `INSERT INTO identity_credentials (user_id, password_hash, password_version, password_algorithm, mfa_ciphertext, mfa_key_version, recovery_codes, failed_login_count, last_failed_login_at, lockout_until)
       VALUES ${credPlaceholders}
       ON CONFLICT (user_id) DO NOTHING`,
      credentialRows.flat(),
    );

    progress(`Users: ${end}/${userCount}`);
  }

  done(`${userCount} users generated`);
  return userIds;
}

// ── Workspaces + members ──────────────────────────────────────────────────────

async function generateWorkspaces(client: pg.PoolClient, userIds: string[]): Promise<string[]> {
  const { workspaces: wsCount } = scale;
  const workspaceIds: string[] = [];

  // Fetch built-in role IDs
  const { rows: roleRows } = await client.query<{ id: string; name: string }>(
    `SELECT id, name FROM workspace_roles WHERE builtin = TRUE AND _archived_at IS NULL`,
  );
  const memberRoleId = roleRows.find((r) => r.name === 'member')?.id;
  const adminRoleId = roleRows.find((r) => r.name === 'admin')?.id;

  for (let i = 0; i < wsCount; i++) {
    const wsId = randomUUID();
    const ownerIdx = i % userIds.length;
    const ownerId = userIds[ownerIdx]!;
    const slug = `${LOAD_TEST_WORKSPACE_PREFIX}${padded(i + 1, 3)}`;
    const now = new Date(Date.now() - Math.floor(Math.random() * 14 * 86400_000));
    const hasLongDesc = i % 20 === 0;
    const description = hasLongDesc
      ? 'A'.repeat(480) // long description edge case
      : `Load test workspace ${padded(i + 1, 3)}`;

    await client.query(
      `INSERT INTO workspaces (id, _version, name, slug, description, owner_user_id, settings, _created_at, _updated_at, _created_by)
       VALUES ($1, 1, $2, $3, $4, $5, '{}', $6, $6, $5)
       ON CONFLICT (slug) DO NOTHING`,
      [wsId, `Load Test Workspace ${padded(i + 1, 3)}`, slug, description, ownerId, now],
    );

    workspaceIds.push(wsId);

    // Owner as member (admin role)
    const ownerMemberId = randomUUID();
    await client.query(
      `INSERT INTO workspace_members (id, _version, workspace_id, user_id, status, invited_at, _created_at, _updated_at)
       VALUES ($1, 1, $2, $3, 'active', $4, $4, $4)
       ON CONFLICT DO NOTHING`,
      [ownerMemberId, wsId, ownerId, now],
    );
    if (adminRoleId) {
      await client.query(
        `INSERT INTO workspace_member_roles (id, _version, workspace_member_id, role_id, _created_at, _updated_at)
         VALUES ($1, 1, $2, $3, $4, $4)
         ON CONFLICT DO NOTHING`,
        [randomUUID(), ownerMemberId, adminRoleId, now],
      );
    }

    // Add ~100 random members per workspace (member role)
    const membersPerWs = Math.min(100, userIds.length - 1);
    const memberBatch: unknown[][] = [];
    const memberRoleBatch: unknown[][] = [];
    const selectedIdxs = new Set<number>();
    selectedIdxs.add(ownerIdx);

    while (selectedIdxs.size < membersPerWs + 1) {
      selectedIdxs.add(Math.floor(Math.random() * userIds.length));
    }

    for (const idx of selectedIdxs) {
      if (idx === ownerIdx) continue;
      const memberId = randomUUID();
      memberBatch.push([memberId, wsId, userIds[idx], now]);
      if (memberRoleId) {
        memberRoleBatch.push([randomUUID(), memberId, memberRoleId, now]);
      }
    }

    if (memberBatch.length > 0) {
      const mPlaceholders = memberBatch
        .map((_, j) => {
          const b = j * 4;
          return `($${b + 1}, 1, $${b + 2}, $${b + 3}, 'active', $${b + 4}, $${b + 4}, $${b + 4})`;
        })
        .join(',');
      await client.query(
        `INSERT INTO workspace_members (id, _version, workspace_id, user_id, status, invited_at, _created_at, _updated_at)
         VALUES ${mPlaceholders} ON CONFLICT DO NOTHING`,
        memberBatch.flat(),
      );
    }

    if (memberRoleBatch.length > 0 && memberRoleId) {
      const mrPlaceholders = memberRoleBatch
        .map((_, j) => {
          const b = j * 4;
          return `($${b + 1}, 1, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 4})`;
        })
        .join(',');
      await client.query(
        `INSERT INTO workspace_member_roles (id, _version, workspace_member_id, role_id, _created_at, _updated_at)
         VALUES ${mrPlaceholders} ON CONFLICT DO NOTHING`,
        memberRoleBatch.flat(),
      );
    }

    progress(`Workspaces: ${i + 1}/${wsCount}`);
  }

  done(`${wsCount} workspaces generated`);
  return workspaceIds;
}

// ── Invitations (proxy for "artifacts" until Objective 11 adds that table) ────

async function generateInvitations(
  client: pg.PoolClient,
  workspaceIds: string[],
  userIds: string[],
): Promise<void> {
  const { invitationsPerWorkspace } = scale;
  const totalInvitations = workspaceIds.length * invitationsPerWorkspace;
  const BATCH = 1000;
  let inserted = 0;

  for (const wsId of workspaceIds) {
    const ownerId = userIds[Math.floor(Math.random() * userIds.length)]!;
    const rows: unknown[][] = [];

    for (let i = 0; i < invitationsPerWorkspace; i++) {
      const email = `invite-${randomUUID()}@${LOAD_TEST_EMAIL_DOMAIN}`;
      const token = randomBytes(32).toString('base64url');
      const tHash = tokenHash(token);
      const now = new Date(Date.now() - Math.floor(Math.random() * 7 * 86400_000));
      const expiresAt = new Date(now.getTime() + 72 * 3600_000);
      // Some invitations already accepted (realistic distribution)
      const accepted = Math.random() < 0.3;
      const acceptedAt = accepted
        ? new Date(now.getTime() + Math.floor(Math.random() * 48 * 3600_000))
        : null;

      rows.push([
        randomUUID(),
        wsId,
        email,
        ownerId,
        JSON.stringify([]),
        tHash,
        expiresAt,
        acceptedAt,
        accepted ? userIds[Math.floor(Math.random() * userIds.length)] : null,
        now,
      ]);

      if (rows.length >= BATCH) {
        const placeholders = rows
          .map((_, j) => {
            const b = j * 10;
            return `($${b + 1}, 1, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}, $${b + 10}, $${b + 10}, $${b + 10})`;
          })
          .join(',');
        await client.query(
          `INSERT INTO workspace_invitations (id, _version, workspace_id, email, invited_by_user_id, initial_roles, token_hash, expires_at, accepted_at, accepted_by_user_id, _created_at, _updated_at, invited_at)
           VALUES ${placeholders} ON CONFLICT DO NOTHING`,
          rows.flat(),
        );
        inserted += rows.length;
        progress(`Invitations: ${inserted}/${totalInvitations}`);
        rows.length = 0;
      }
    }

    // Flush remainder
    if (rows.length > 0) {
      const placeholders = rows
        .map((_, j) => {
          const b = j * 10;
          return `($${b + 1}, 1, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}, $${b + 10}, $${b + 10}, $${b + 10})`;
        })
        .join(',');
      await client.query(
        `INSERT INTO workspace_invitations (id, _version, workspace_id, email, invited_by_user_id, initial_roles, token_hash, expires_at, accepted_at, accepted_by_user_id, _created_at, _updated_at, invited_at)
         VALUES ${placeholders} ON CONFLICT DO NOTHING`,
        rows.flat(),
      );
      inserted += rows.length;
    }
  }

  done(`${totalInvitations} invitations generated (proxy for artifacts until Objective 11)`);
}

// ── Audit events ──────────────────────────────────────────────────────────────

const AUDIT_EVENT_TYPES = [
  'workspace.created',
  'workspace.updated',
  'workspace.archived',
  'member.added',
  'member.removed',
  'member.role_changed',
  'invitation.created',
  'invitation.accepted',
  'invitation.revoked',
  'auth.sign_in',
  'auth.sign_out',
  'auth.sign_in_failed',
  'approval.created',
  'approval.approved',
  'approval.rejected',
  'session.created',
  'session.expired',
];

const RESOURCE_TYPES = ['workspace', 'member', 'invitation', 'session', 'approval'];
const ACTOR_KINDS = ['user', 'user', 'user', 'system'] as const;
const OUTCOMES = ['success', 'success', 'success', 'success', 'failure', 'denied'] as const;
const IP_SAMPLES = [
  '192.168.1.1',
  '10.0.0.1',
  '172.16.0.1',
  null,
  null,
  '2001:db8::1',
  '203.0.113.5',
];

async function generateAuditEvents(
  client: pg.PoolClient,
  workspaceIds: string[],
  userIds: string[],
): Promise<void> {
  const { auditPerWorkspace } = scale;
  const totalAudit = workspaceIds.length * auditPerWorkspace;
  let inserted = 0;
  const BATCH = 2000;

  // Base time: spread events over last 365 days
  const now = Date.now();
  const yearAgoMs = now - 365 * 86400_000;

  for (const wsId of workspaceIds) {
    // Ensure audit_chain_state row exists for this workspace
    await client.query(
      `INSERT INTO audit_chain_state (workspace_id, last_sequence, last_hash, initialization_seed)
       VALUES ($1, 0, $2, $3)
       ON CONFLICT (workspace_id) DO NOTHING`,
      [wsId, GENESIS_HASH, randomBytes(32).toString('hex').substring(0, 64)],
    );

    let prevHash = GENESIS_HASH;
    let sequence = 1;
    const rows: unknown[][] = [];

    for (let i = 0; i < auditPerWorkspace; i++) {
      const actorIdx = Math.floor(Math.random() * userIds.length);
      const actorId = userIds[actorIdx]!;
      const eventType = AUDIT_EVENT_TYPES[Math.floor(Math.random() * AUDIT_EVENT_TYPES.length)]!;
      const resourceType = RESOURCE_TYPES[Math.floor(Math.random() * RESOURCE_TYPES.length)]!;
      const resourceId = randomUUID();
      const action = eventType;
      const outcome = OUTCOMES[Math.floor(Math.random() * OUTCOMES.length)]!;
      const actorKind = ACTOR_KINDS[Math.floor(Math.random() * ACTOR_KINDS.length)]!;
      const correlationId = randomUUID();
      const ipAddress = IP_SAMPLES[Math.floor(Math.random() * IP_SAMPLES.length)] ?? null;
      const occurredAtMs = yearAgoMs + Math.floor(Math.random() * (now - yearAgoMs));
      const occurredAt = new Date(occurredAtMs);

      const hash = computeAuditHash(
        eventType,
        wsId,
        actorKind,
        actorId,
        resourceType,
        resourceId,
        action,
        outcome,
        correlationId,
        sequence,
        occurredAtMs,
        prevHash,
      );

      rows.push([
        randomUUID(),
        sequence,
        wsId,
        eventType,
        occurredAt,
        actorKind,
        actorId,
        'builtin',
        null,
        resourceType,
        resourceId,
        action,
        outcome,
        null,
        '{}',
        ipAddress,
        null,
        correlationId,
        prevHash,
        hash,
      ]);

      prevHash = hash;
      sequence++;

      if (rows.length >= BATCH) {
        await flushAuditBatch(client, rows);
        inserted += rows.length;
        progress(`Audit events: ${inserted}/${totalAudit}`);
        rows.length = 0;
      }
    }

    // Flush remainder and update chain state
    if (rows.length > 0) {
      await flushAuditBatch(client, rows);
      inserted += rows.length;
      rows.length = 0;
    }

    // Update chain state to reflect final hash/sequence
    await client.query(
      `UPDATE audit_chain_state SET last_sequence = $1, last_hash = $2 WHERE workspace_id = $3`,
      [sequence - 1, prevHash, wsId],
    );
  }

  done(`${totalAudit} audit events generated`);
}

async function flushAuditBatch(client: pg.PoolClient, rows: unknown[][]): Promise<void> {
  const placeholders = rows
    .map((_, j) => {
      const b = j * 20;
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},$${b + 12},$${b + 13},$${b + 14},$${b + 15},$${b + 16},$${b + 17},$${b + 18},$${b + 19},$${b + 20})`;
    })
    .join(',');
  await client.query(
    `INSERT INTO audit_log
       (id, sequence, workspace_id, event_type, occurred_at,
        actor_kind, actor_id, actor_identity_provider, actor_email_snapshot,
        resource_type, resource_id, action, outcome,
        reason, metadata, ip_address, user_agent, correlation_id,
        prev_hash, hash)
     VALUES ${placeholders}
     ON CONFLICT DO NOTHING`,
    rows.flat(),
  );
}

// ── Export k6 user data ───────────────────────────────────────────────────────

async function exportK6UserData(userIds: string[]): Promise<void> {
  const { writeFile, mkdir } = await import('node:fs/promises');
  const { join } = await import('node:path');

  const outDir = join(import.meta.dirname, '..', 'data');
  await mkdir(outDir, { recursive: true });

  const users = userIds.slice(0, 1000).map((id, i) => ({
    id,
    email: `${LOAD_TEST_USER_PREFIX}${padded(i + 1, 5)}@${LOAD_TEST_EMAIL_DOMAIN}`,
    password: LOAD_TEST_PASSWORD,
  }));

  await writeFile(join(outDir, 'users.json'), JSON.stringify(users, null, 2));
  done('Exported k6 user data to tests/load/data/users.json');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\nLighthouse Studio — Load Test Data Generator`);
  console.log(
    `Scale: ${scaleArg} (${scale.users} users, ${scale.workspaces} workspaces, ${scale.workspaces * scale.auditPerWorkspace} audit events)`,
  );
  console.log('');

  const client = await pool.connect();
  try {
    if (doClean) {
      await cleanLoadTestData(client);
    }

    // Check if already seeded
    const { rows: existing } = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM identity_users WHERE primary_email LIKE '%@${LOAD_TEST_EMAIL_DOMAIN}'`,
    );
    const existingCount = parseInt(existing[0]?.count ?? '0', 10);
    if (existingCount >= scale.users && !doClean) {
      console.log(
        `Load-test data already present (${existingCount} users). Use --clean to regenerate.`,
      );
      return;
    }

    console.log('Hashing test password (argon2id — once only)...');
    const passwordHash = await argon2Hash(LOAD_TEST_PASSWORD, ARGON2_OPTIONS);
    done('Password hashed');

    const userIds = await generateUsers(client, passwordHash);
    const workspaceIds = await generateWorkspaces(client, userIds);
    await generateInvitations(client, workspaceIds, userIds);
    await generateAuditEvents(client, workspaceIds, userIds);
    await exportK6UserData(userIds);

    console.log('\n✅ Load test data generation complete.\n');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
