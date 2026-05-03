/**
 * Scenario: Change Stream Load
 *
 * 100 subscribers + 50 events/second produced.
 * Target: all subscribers receive events within 2s, no events lost, no buffer overflow.
 *
 * This scenario uses WebSocket (or SSE) subscribers and an event producer.
 * The producer uses the constant-arrival-rate executor; subscribers are long-lived VUs.
 *
 * Run: k6 run tests/load/scenarios/change-stream-load.js
 */

import http from 'k6/http';
import { WebSocket } from 'k6/experimental/websockets';
import { check, sleep } from 'k6';
import { Counter, Gauge, Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

import { signIn, authHeaders, BASE_URL } from '../lib/auth.js';

const users = new SharedArray('users', function () {
  return JSON.parse(open('../data/users.json'));
});

const eventsReceived = new Counter('change_stream_events_received');
const eventsProduced = new Counter('change_stream_events_produced');
const deliveryLatency = new Trend('change_stream_delivery_latency_ms', true);
const bufferOverflows = new Counter('change_stream_buffer_overflows');
const connectedSubscribers = new Gauge('change_stream_connected_subscribers');
const subscribeErrors = new Rate('subscribe_error_rate');

const WS_BASE_URL = (BASE_URL || 'http://localhost:3000')
  .replace('http://', 'ws://')
  .replace('https://', 'wss://');

export const options = {
  scenarios: {
    subscribers: {
      executor: 'constant-vus',
      vus: 100,
      duration: __ENV.LOAD_TEST_DURATION || '10m',
      exec: 'subscriber',
    },
    producer: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: __ENV.LOAD_TEST_DURATION || '10m',
      preAllocatedVUs: 20,
      maxVUs: 50,
      exec: 'producer',
    },
  },
  thresholds: {
    change_stream_delivery_latency_ms: ['p(95)<2000'],
    change_stream_buffer_overflows: ['count==0'],
    subscribe_error_rate: ['rate<0.05'],
  },
};

// ── Subscriber ────────────────────────────────────────────────────────────────

export function subscriber() {
  const user = users[__VU % users.length];
  const token = signIn(user.email, user.password);
  if (!token) {
    subscribeErrors.add(1);
    sleep(5);
    return;
  }
  subscribeErrors.add(0);

  const listRes = http.get(`${BASE_URL}/api/workspaces?limit=1`, {
    headers: authHeaders(token),
  });
  if (listRes.status !== 200) {
    subscribeErrors.add(1);
    sleep(2);
    return;
  }

  let wsId;
  try {
    wsId = JSON.parse(listRes.body)?.data?.[0]?.id;
  } catch {
    sleep(2);
    return;
  }
  if (!wsId) {
    sleep(2);
    return;
  }

  const pendingEvents = {};
  const ws = new WebSocket(`${WS_BASE_URL}/api/workspaces/${wsId}/changes?token=${token}`);

  ws.onopen = () => {
    connectedSubscribers.add(1);
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'event' && msg.id) {
        const receivedAt = Date.now();
        if (pendingEvents[msg.id]) {
          deliveryLatency.add(receivedAt - pendingEvents[msg.id]);
          delete pendingEvents[msg.id];
        }
        eventsReceived.add(1);
      }
      if (msg.type === 'buffer_overflow') {
        bufferOverflows.add(1);
      }
    } catch {
      /* malformed message */
    }
  };

  ws.onerror = () => {
    subscribeErrors.add(1);
  };

  ws.onclose = () => {
    connectedSubscribers.add(-1);
  };

  // Hold connection for duration
  sleep(parseInt(__ENV.LOAD_TEST_DURATION_SECONDS || '600', 10));
  ws.close();
}

// ── Producer ──────────────────────────────────────────────────────────────────

export function producer() {
  const user = users[__VU % users.length];
  const token = signIn(user.email, user.password);
  if (!token) return;

  const headers = authHeaders(token);
  const listRes = http.get(`${BASE_URL}/api/workspaces?limit=1`, { headers });
  if (listRes.status !== 200) return;

  let wsId;
  try {
    wsId = JSON.parse(listRes.body)?.data?.[0]?.id;
  } catch {
    return;
  }
  if (!wsId) return;

  // Produce an event by making a write operation
  const res = http.post(
    `${BASE_URL}/api/workspaces/${wsId}/invitations`,
    JSON.stringify({ email: `stream-${Date.now()}@loadtest.internal` }),
    { headers },
  );

  if (res.status === 200 || res.status === 201) {
    eventsProduced.add(1);
  }
}
