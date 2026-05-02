import { runMfaConformance } from '@platform/ports-identity/conformance';

import { InMemoryMfaAdapter, InMemoryUserDirectory } from '../src/index.js';

runMfaConformance('InMemoryMfaAdapter', async () => {
  const dir = new InMemoryUserDirectory();
  const user = (
    await dir.create({
      email: 'mfa-test@example.com',
      identity: {
        providerId: 'builtin',
        subject: 'mfa-test-sub-001',
        emailVerified: false,
      },
    })
  )._unsafeUnwrap();
  return { mfa: new InMemoryMfaAdapter(dir), userId: user.id };
});
