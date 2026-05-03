/**
 * Scenario: Audit Query Load
 *
 * 10 audit-log queries/second against workspaces with 10k+ audit events.
 * Target: p95 query latency < 200ms, no locking issues.
 *
 * Run: k6 run tests/load/scenarios/audit-query.js
 */

import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

import { signIn, authHeaders, BASE_URL } from '../lib/auth.js';

const users = new SharedArray('users', function () {
  return JSON.parse(open('../data/users.json'));
});

const auditQueryLatency = new Trend('audit_query_p95', true);
const errorRate = new Rate('error_rate');

export const options = {
  scenarios: {
    auditQueries: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: __ENV.LOAD_TEST_DURATION || '10m',
      preAllocatedVUs: 30,
      maxVUs: 50,
    },
  },
  thresholds: {
    audit_query_p95: ['p(95)<200', 'p(99)<500'],
    error_rate: ['rate<0.001'],
  },
};

const tokenCache = {};

function getToken(user) {
  if (!tokenCache[user.email]) {
    tokenCache[user.email] = signIn(user.email, user.password);
  }
  return tokenCache[user.email];
}

export default function () {
  const user = users[__VU % users.length];
  const token = getToken(user);
  if (!token) {
    errorRate.add(1);
    return;
  }
  errorRate.add(0);

  const headers = authHeaders(token);

  // Get workspaces first
  const listRes = http.get(`${BASE_URL}/api/workspaces?limit=5`, { headers });
  if (listRes.status !== 200) {
    errorRate.add(1);
    return;
  }

  let workspaces;
  try {
    workspaces = JSON.parse(listRes.body)?.data;
  } catch {
    return;
  }
  if (!workspaces?.length) return;

  const ws = workspaces[Math.floor(Math.random() * workspaces.length)];

  // Randomize query patterns to simulate realistic usage
  const queryType = Math.floor(Math.random() * 4);
  let url;

  if (queryType === 0) {
    // Recent events (most common)
    url = `${BASE_URL}/api/workspaces/${ws.id}/audit-log?limit=50`;
  } else if (queryType === 1) {
    // Filter by resource type
    url = `${BASE_URL}/api/workspaces/${ws.id}/audit-log?resourceType=workspace&limit=50`;
  } else if (queryType === 2) {
    // Time-range query (last 7 days)
    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    url = `${BASE_URL}/api/workspaces/${ws.id}/audit-log?since=${since}&limit=100`;
  } else {
    // Deep page (cursor-based)
    url = `${BASE_URL}/api/workspaces/${ws.id}/audit-log?limit=100`;
  }

  const start = Date.now();
  const res = http.get(url, { headers });
  auditQueryLatency.add(Date.now() - start);

  check(res, {
    'audit query 200': (r) => r.status === 200,
    'audit response has data': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body)?.data);
      } catch {
        return false;
      }
    },
  });

  if (res.status !== 200) errorRate.add(1);
}
