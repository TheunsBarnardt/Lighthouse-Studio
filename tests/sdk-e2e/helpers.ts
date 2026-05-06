import { createClient } from '@platform/sdk';

const PLATFORM_URL = process.env['PLATFORM_URL'];
const ANON_KEY = process.env['PLATFORM_ANON_KEY'] ?? '';
const TEST_EMAIL = process.env['PLATFORM_TEST_EMAIL'] ?? 'sdk-e2e@test.local';
const TEST_PASSWORD = process.env['PLATFORM_TEST_PASSWORD'] ?? 'changeme-e2e';

export const E2E_ENABLED = Boolean(PLATFORM_URL);

export function makeClient() {
  if (!PLATFORM_URL) throw new Error('PLATFORM_URL not set');
  return createClient({ url: PLATFORM_URL, anonKey: ANON_KEY });
}

export const testCredentials = { email: TEST_EMAIL, password: TEST_PASSWORD };
