import { InMemoryEmailPort } from '@platform/adapter-communication-memory';
import { InMemoryUserDirectory, InMemorySessionAdapter } from '@platform/adapter-identity-memory';
import { runIdentityProviderConformance } from '@platform/ports-identity/conformance';
import { describe, expect, it } from 'vitest';

import {
  BuiltinIdentityProvider,
  EmailVerificationFlow,
  InMemoryFlowStore,
  MagicLinkFlow,
  PasswordResetFlow,
} from '../src/index.js';

function makeProvider() {
  const dir = new InMemoryUserDirectory();
  const sessions = new InMemorySessionAdapter();
  const email = new InMemoryEmailPort();
  const flowStore = new InMemoryFlowStore();

  const emailVerification = new EmailVerificationFlow(flowStore, email, {
    tokenSecret: 'test-secret-1234',
    verifyUrl: 'http://localhost:3000/verify',
    fromEmail: 'noreply@example.com',
  });

  const passwordReset = new PasswordResetFlow(flowStore, dir, email, {
    tokenSecret: 'test-secret-5678',
    resetUrl: 'http://localhost:3000/reset',
    fromEmail: 'noreply@example.com',
  });

  const magicLink = new MagicLinkFlow(flowStore, dir, email, {
    tokenSecret: 'test-secret-abcd',
    callbackUrl: 'http://localhost:3000/magic',
    fromEmail: 'noreply@example.com',
  });

  return new BuiltinIdentityProvider(
    { userDirectory: dir, sessions, emailVerification, passwordReset, magicLink },
    { selfServiceSignup: true, hibpCheck: false },
  );
}

runIdentityProviderConformance('BuiltinIdentityProvider', () => Promise.resolve(makeProvider()));

describe('BuiltinIdentityProvider — password flow', () => {
  it('signup + password sign-in returns a complete challenge', async () => {
    const provider = makeProvider();

    const signupResult = await provider.signup('alice@example.com', 'CorrectHorseBatteryStaple1');
    expect(signupResult.isOk()).toBe(true);

    const signIn = await provider.beginSignIn({
      method: 'password',
      email: 'alice@example.com',
      password: 'CorrectHorseBatteryStaple1',
    });
    expect(signIn.isOk()).toBe(true);
    const challenge = signIn._unsafeUnwrap();
    expect(challenge.kind).toBe('complete');
  });

  it('password sign-in with wrong password returns INVALID_CREDENTIALS', async () => {
    const provider = makeProvider();
    await provider.signup('bob@example.com', 'CorrectHorseBatteryStaple1');

    const signIn = await provider.beginSignIn({
      method: 'password',
      email: 'bob@example.com',
      password: 'WrongPassword123456',
    });
    expect(signIn.isErr()).toBe(true);
    expect(signIn._unsafeUnwrapErr().code).toBe('INVALID_CREDENTIALS');
  });

  it('account lockout after 5 failed attempts', async () => {
    const dir = new InMemoryUserDirectory();
    const sessions = new InMemorySessionAdapter();
    const email = new InMemoryEmailPort();
    const flowStore = new InMemoryFlowStore();

    const emailVerification = new EmailVerificationFlow(flowStore, email, {
      tokenSecret: 'ts1',
      verifyUrl: 'http://x',
      fromEmail: 'x@x.com',
    });
    const passwordReset = new PasswordResetFlow(flowStore, dir, email, {
      tokenSecret: 'ts2',
      resetUrl: 'http://x',
      fromEmail: 'x@x.com',
    });
    const magicLink = new MagicLinkFlow(flowStore, dir, email, {
      tokenSecret: 'ts3',
      callbackUrl: 'http://x',
      fromEmail: 'x@x.com',
    });

    const p = new BuiltinIdentityProvider(
      { userDirectory: dir, sessions, emailVerification, passwordReset, magicLink },
      { selfServiceSignup: true, hibpCheck: false },
    );

    await p.signup('charlie@example.com', 'CorrectHorseBatteryStaple1');

    for (let i = 0; i < 5; i++) {
      await p.beginSignIn({
        method: 'password',
        email: 'charlie@example.com',
        password: 'WrongPassword',
      });
    }

    const locked = await p.beginSignIn({
      method: 'password',
      email: 'charlie@example.com',
      password: 'CorrectHorseBatteryStaple1',
    });
    expect(locked.isErr()).toBe(true);
    expect(locked._unsafeUnwrapErr().code).toBe('ACCOUNT_LOCKED');
  });

  it('magic link sign-in returns magic_link_sent', async () => {
    const p2 = makeProvider();
    await p2.signup('dave@example.com', 'CorrectHorseBatteryStaple1');

    const result = await p2.beginSignIn({
      method: 'magic_link',
      email: 'dave@example.com',
    });
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().kind).toBe('magic_link_sent');
  });

  it('signup is rejected when selfServiceSignup is disabled', async () => {
    const dir = new InMemoryUserDirectory();
    const sessions = new InMemorySessionAdapter();
    const email = new InMemoryEmailPort();
    const flowStore = new InMemoryFlowStore();
    const emailVerification = new EmailVerificationFlow(flowStore, email, {
      tokenSecret: 'ts1',
      verifyUrl: 'http://x',
      fromEmail: 'x@x.com',
    });
    const passwordReset = new PasswordResetFlow(flowStore, dir, email, {
      tokenSecret: 'ts2',
      resetUrl: 'http://x',
      fromEmail: 'x@x.com',
    });
    const magicLink = new MagicLinkFlow(flowStore, dir, email, {
      tokenSecret: 'ts3',
      callbackUrl: 'http://x',
      fromEmail: 'x@x.com',
    });

    const p = new BuiltinIdentityProvider(
      { userDirectory: dir, sessions, emailVerification, passwordReset, magicLink },
      { selfServiceSignup: false, hibpCheck: false },
    );

    const result = await p.signup('eve@example.com', 'CorrectHorseBatteryStaple1');
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe('NOT_SUPPORTED');
  });
});
