// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import axe from 'axe-core';
import React from 'react';

// next-intl: stub the translation hook and provider
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// next/navigation stubs
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useParams: () => ({ slug: 'test-workspace', userId: 'test-user' }),
  useSearchParams: () => new URLSearchParams(),
}));

// Prevent real network calls from auth-client
vi.mock('@/lib/auth-client', () => ({
  AuthApiError: class AuthApiError extends Error {},
  authApi: {
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    verifyEmail: vi.fn(),
    requestMagicLink: vi.fn(),
    consumeMagicLink: vi.fn(),
    mfaChallenge: vi.fn(),
    getMe: vi.fn(),
    listSessions: vi.fn().mockResolvedValue([]),
    revokeSession: vi.fn(),
    revokeAllSessions: vi.fn(),
    validateInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
  },
}));

vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({ user: null, refresh: vi.fn(), signOut: vi.fn() }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// CaptchaWidget renders nothing in test environment (no NEXT_PUBLIC_CAPTCHA_SITE_KEY)
vi.mock('@/components/ui/captcha-widget', () => ({
  CaptchaWidget: () => null,
}));

async function axeCheck(importFn: () => Promise<{ default: React.ComponentType }>) {
  const { default: Page } = await importFn();
  const { container } = render(<Page />);
  const results = await axe.run(container);
  return results.violations;
}

describe('Auth page accessibility', () => {
  it('sign-in page: no critical axe violations', async () => {
    const violations = await axeCheck(() => import('../sign-in/page'));
    const critical = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toHaveLength(0);
  });

  it('sign-up page: no critical axe violations', async () => {
    const violations = await axeCheck(() => import('../sign-up/page'));
    const critical = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toHaveLength(0);
  });

  it('forgot-password page: no critical axe violations', async () => {
    const violations = await axeCheck(() => import('../forgot-password/page'));
    const critical = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toHaveLength(0);
  });

  it('reset-password page: no critical axe violations', async () => {
    const violations = await axeCheck(() => import('../reset-password/page'));
    const critical = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toHaveLength(0);
  });

  it('mfa-challenge page: no critical axe violations', async () => {
    const violations = await axeCheck(() => import('../mfa-challenge/page'));
    const critical = violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical).toHaveLength(0);
  });
});
