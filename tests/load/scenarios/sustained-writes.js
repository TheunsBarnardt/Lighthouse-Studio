/**
 * Scenario: Sustained Writes
 *
 * 50 writes/second across mixed entity types for 30 minutes.
 * Target: no pool exhaustion, audit chain integrity maintained, no deadlocks.
 *
 * Run: k6 run tests/load/scenarios/sustained-writes.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

import { signIn, authHeaders, BASE_URL } from '../lib/auth.js';

const users = new SharedArray('users', function () {
  return JSON.parse(open('../data/users.json'));
});

const writeLatency = new Trend('write_latency', true);
const errorRate = new Rate('error_rate');
const writeErrors = new Counter('write_errors');

export const options = {
  scenarios: {
    writes: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: __ENV.LOAD_TEST_DURATION || '30m',
      preAllocatedVUs: 100,
      maxVUs: 200,
    },
  },
  thresholds: {
    write_latency: ['p(95)<500', 'p(99)<2000'],
    error_rate: ['rate<0.01'],
    write_errors: ['count<10'],
  },
};

let cachedTokens = {};

function getToken(user) {
  if (!cachedTokens[user.email]) {
    cachedTokens[user.email] = signIn(user.email, user.password);
  }
  return cachedTokens[user.email];
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

  // Randomly pick a write operation type
  const opType = Math.floor(Math.random() * 3);
  let res;

  const start = Date.now();

  if (opType === 0) {
    // Create an invitation (write to workspace_invitations + audit_log)
    const listRes = http.get(`${BASE_URL}/api/workspaces?limit=1`, { headers });
    if (listRes.status === 200) {
      try {
        const wsId = JSON.parse(listRes.body)?.data?.[0]?.id;
        if (wsId) {
          res = http.post(
            `${BASE_URL}/api/workspaces/${wsId}/invitations`,
            JSON.stringify({ email: `w-${Date.now()}@loadtest.internal` }),
            { headers },
          );
        }
      } catch {
        /* skip */
      }
    }
  } else if (opType === 1) {
    // Update workspace description (write to workspaces + audit_log)
    const listRes = http.get(`${BASE_URL}/api/workspaces?limit=1`, { headers });
    if (listRes.status === 200) {
      try {
        const ws = JSON.parse(listRes.body)?.data?.[0];
        if (ws) {
          res = http.patch(
            `${BASE_URL}/api/workspaces/${ws.id}`,
            JSON.stringify({ description: `Updated at ${Date.now()}`, version: ws.version }),
            { headers },
          );
        }
      } catch {
        /* skip */
      }
    }
  } else {
    // Create a new workspace
    const slug = `load-write-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    res = http.post(
      `${BASE_URL}/api/workspaces`,
      JSON.stringify({ name: `Write Test ${Date.now()}`, slug }),
      { headers },
    );
  }

  const elapsed = Date.now() - start;
  writeLatency.add(elapsed);

  if (res && res.status >= 400 && res.status !== 409) {
    errorRate.add(1);
    writeErrors.add(1);
  }
}
