/**
 * Scenario: Burst Load
 *
 * 500 concurrent users for 5 minutes, then cool-down.
 * Target: p95 < 1s, error rate < 0.1%, recovery within 60s.
 *
 * Run: k6 run tests/load/scenarios/burst-load.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

import { signIn, authHeaders, BASE_URL } from '../lib/auth.js';

const users = new SharedArray('users', function () {
  return JSON.parse(open('../data/users.json'));
});

const errorRate = new Rate('error_rate');
const burstLatency = new Trend('burst_latency', true);

export const options = {
  scenarios: {
    burst: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 500 }, // ramp to 500
        { duration: '5m', target: 500 }, // hold burst
        { duration: '60s', target: 0 }, // ramp down — verify recovery in 60s
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<3000'],
    error_rate: ['rate<0.001'],
    burst_latency: ['p(95)<1000'],
  },
};

export default function () {
  const user = users[__VU % users.length];

  const token = signIn(user.email, user.password);
  if (!token) {
    errorRate.add(1);
    return;
  }
  errorRate.add(0);

  const headers = authHeaders(token);

  const start = Date.now();
  const res = http.get(`${BASE_URL}/api/workspaces`, { headers });
  burstLatency.add(Date.now() - start);

  check(res, { 'workspace list under burst': (r) => r.status === 200 });
  if (res.status !== 200) errorRate.add(1);

  sleep(0.2);
}
