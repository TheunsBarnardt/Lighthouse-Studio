import { describe, expect, it } from 'vitest';

import { WindowsIntegratedIdentityProvider } from '../src/index.js';

// Windows Integrated Auth does not use JWT tokens — it trusts the IIS-injected
// principal header. The shared IdentityProviderPort conformance suite assumes
// cryptographic token validation, which does not apply here. This suite covers
// all interface methods directly against the adapter's semantics.

function makeProvider() {
  return new WindowsIntegratedIdentityProvider({
    principalHeader: 'X-Windows-Principal',
    trustedProxyIps: ['127.0.0.1'],
  });
}

describe('WindowsIntegratedIdentityProvider — IdentityProviderPort', () => {
  it('verifyToken rejects an empty principal', async () => {
    const result = await makeProvider().verifyToken('');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('INVALID_CREDENTIALS');
  });

  it('verifyToken rejects a whitespace-only principal', async () => {
    const result = await makeProvider().verifyToken('   ');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('INVALID_CREDENTIALS');
  });

  it('verifyToken resolves DOMAIN\\user to user@domain', async () => {
    const result = await makeProvider().verifyToken('CORP\\alice');
    expect(result.isOk()).toBe(true);
    const identity = result._unsafeUnwrap();
    expect(identity.subject).toBe('alice@corp');
    expect(identity.displayName).toBe('alice');
    expect(identity.providerId).toBe('windows-integrated');
    expect(identity.emailVerified).toBe(true);
  });

  it('verifyToken resolves a bare username without domain', async () => {
    const result = await makeProvider().verifyToken('bob');
    expect(result.isOk()).toBe(true);
    const identity = result._unsafeUnwrap();
    expect(identity.subject).toBe('bob');
    expect(identity.displayName).toBe('bob');
  });

  it('verifyToken exposes the original principal in claims', async () => {
    const result = await makeProvider().verifyToken('CORP\\carol');
    expect(result.isOk()).toBe(true);
    const claims = result._unsafeUnwrap().claims;
    expect(claims['windowsPrincipal']).toBe('CORP\\carol');
    expect(claims['principalHeader']).toBe('X-Windows-Principal');
  });

  it('verifyToken produces an email for DOMAIN\\user format', async () => {
    const result = await makeProvider().verifyToken('CORP\\dave');
    expect(result.isOk()).toBe(true);
    const identity = result._unsafeUnwrap();
    expect(identity.email).toBe('dave@corp');
  });

  it('beginSignIn returns NOT_SUPPORTED', async () => {
    const result = await makeProvider().beginSignIn({
      method: 'password',
      email: 'x',
      password: 'y',
    });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_SUPPORTED');
  });

  it('completeSignIn returns NOT_SUPPORTED', async () => {
    const result = await makeProvider().completeSignIn({ method: 'password' });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_SUPPORTED');
  });

  it('signOut succeeds idempotently', async () => {
    const result = await makeProvider().signOut('any-token');
    expect(result.isOk()).toBe(true);
  });

  it('supports only sso feature', () => {
    const provider = makeProvider();
    expect(provider.supports('sso')).toBe(true);
    expect(provider.supports('password')).toBe(false);
    expect(provider.supports('mfa_totp')).toBe(false);
    expect(provider.supports('magic_link')).toBe(false);
  });

  it('getMetadata returns valid metadata with sso capability', () => {
    const meta = makeProvider().getMetadata();
    expect(meta.id).toBe('windows-integrated');
    expect(typeof meta.displayName).toBe('string');
    expect(meta.capabilities).toContain('sso');
  });
});
