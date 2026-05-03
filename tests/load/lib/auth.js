/**
 * Shared authentication helper for k6 load test scenarios.
 * Signs in a user and returns the session token for subsequent requests.
 */

import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.LOAD_TEST_BASE_URL || 'http://localhost:3000';

/**
 * Sign in and return the auth token.
 * @param {string} email
 * @param {string} password
 * @returns {string|null} session token or null on failure
 */
export function signIn(email, password) {
  const res = http.post(`${BASE_URL}/api/auth/sign-in`, JSON.stringify({ email, password }), {
    headers: { 'Content-Type': 'application/json' },
  });

  const ok = check(res, {
    'sign-in 200': (r) => r.status === 200,
    'sign-in has token': (r) => {
      try {
        return JSON.parse(r.body).token !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (!ok) return null;
  return JSON.parse(res.body).token;
}

/**
 * Build auth headers from a session token.
 * @param {string} token
 * @returns {Record<string, string>}
 */
export function authHeaders(token) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export { BASE_URL };
