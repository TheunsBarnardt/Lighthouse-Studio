/**
 * Scenario: Sustained Load
 *
 * 100 concurrent users performing typical operations for 1 hour.
 * Target: p95 latency < 500ms, 0% errors, stable memory.
 *
 * Run: k6 run tests/load/scenarios/sustained-load.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

import { signIn, authHeaders, BASE_URL } from '../lib/auth.js';

// ── Test data ─────────────────────────────────────────────────────────────────

const users = new SharedArray('users', function () {
  return JSON.parse(open('../data/users.json'));
});

// ── Custom metrics ────────────────────────────────────────────────────────────

const signInLatency = new Trend('sign_in_latency', true);
const listWorkspacesLatency = new Trend('list_workspaces_latency', true);
const createWorkspaceLatency = new Trend('create_workspace_latency', true);
const auditQueryLatency = new Trend('audit_query_latency', true);
const errorRate = new Rate('error_rate');
const crossTenantLeaks = new Counter('cross_tenant_leaks');

// ── Options ───────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    sustained: {
      executor: 'constant-vus',
      vus: 100,
      duration: __ENV.LOAD_TEST_DURATION || '1h',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<2000'],
    error_rate: ['rate<0.001'],
    sign_in_latency: ['p(95)<500'],
    list_workspaces_latency: ['p(95)<500'],
    audit_query_latency: ['p(95)<200'],
    cross_tenant_leaks: ['count==0'],
  },
};

// ── Main VU function ──────────────────────────────────────────────────────────

export default function () {
  const user = users[__VU % users.length];

  // 1. Sign in
  const startSignIn = Date.now();
  const token = signIn(user.email, user.password);
  signInLatency.add(Date.now() - startSignIn);

  if (!token) {
    errorRate.add(1);
    sleep(1);
    return;
  }
  errorRate.add(0);

  const headers = authHeaders(token);

  // 2. List workspaces
  const startList = Date.now();
  const listRes = http.get(`${BASE_URL}/api/workspaces`, { headers });
  listWorkspacesLatency.add(Date.now() - startList);

  const listOk = check(listRes, {
    'list workspaces 200': (r) => r.status === 200,
  });
  if (!listOk) errorRate.add(1);

  // Check for cross-tenant leakage: response should only contain this user's workspaces
  if (listRes.status === 200) {
    let body;
    try {
      body = JSON.parse(listRes.body);
    } catch {
      body = null;
    }
    if (body?.data) {
      for (const ws of body.data) {
        // Workspaces returned should have this user as a member
        if (ws.ownerId && ws.ownerId !== user.id && !ws.memberIds?.includes(user.id)) {
          crossTenantLeaks.add(1);
        }
      }
    }
  }

  sleep(0.5);

  // 3. Create an artifact (create workspace invitation as proxy)
  if (listRes.status === 200) {
    let workspaceId;
    try {
      const ws = JSON.parse(listRes.body)?.data?.[0];
      workspaceId = ws?.id;
    } catch {
      /* no workspace, skip */
    }

    if (workspaceId) {
      const startCreate = Date.now();
      const inviteRes = http.post(
        `${BASE_URL}/api/workspaces/${workspaceId}/invitations`,
        JSON.stringify({ email: `probe-${Date.now()}@loadtest.internal` }),
        { headers },
      );
      createWorkspaceLatency.add(Date.now() - startCreate);
      check(inviteRes, {
        'create invitation 200/201': (r) => r.status === 200 || r.status === 201,
      });
    }
  }

  sleep(0.5);

  // 4. Query audit log
  if (listRes.status === 200) {
    let workspaceId;
    try {
      workspaceId = JSON.parse(listRes.body)?.data?.[0]?.id;
    } catch {
      /* skip */
    }

    if (workspaceId) {
      const startAudit = Date.now();
      const auditRes = http.get(`${BASE_URL}/api/workspaces/${workspaceId}/audit-log?limit=50`, {
        headers,
      });
      auditQueryLatency.add(Date.now() - startAudit);
      check(auditRes, { 'audit log 200': (r) => r.status === 200 });
    }
  }

  sleep(1);
}
