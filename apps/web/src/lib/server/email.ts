/**
 * Email provider.
 * EMAIL_PROVIDER=console  — fictional: logs the email body to the server console (default)
 * EMAIL_PROVIDER=smtp     — real SMTP via SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD
 *
 * EMAIL_VERIFICATION_REQUIRED=true  — require users to verify their email before signing in
 */
import { getEnv } from '@platform/config';

export function emailVerificationRequired(): boolean {
  return getEnv().EMAIL_VERIFICATION_REQUIRED;
}

interface EmailProvider {
  sendVerificationEmail(opts: {
    to: string;
    userId: string;
    token: string;
    appUrl: string;
  }): Promise<void>;
  sendPasswordReset(opts: { to: string; token: string; appUrl: string }): Promise<void>;
  send2FACode(opts: { to: string; code: string }): Promise<void>;
}

class ConsoleEmailProvider implements EmailProvider {
  sendVerificationEmail(opts: {
    to: string;
    userId: string;
    token: string;
    appUrl: string;
  }): Promise<void> {
    const link = `${opts.appUrl}/auth/verify-email?token=${encodeURIComponent(opts.token)}`;
    // eslint-disable-next-line no-console
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  EMAIL PROVIDER — FICTIONAL (console)                   ║
╠══════════════════════════════════════════════════════════╣
║  To:      ${opts.to.padEnd(46)}║
║  Subject: Verify your email address                      ║
╠══════════════════════════════════════════════════════════╣
  Verification link:
  ${link}
╚══════════════════════════════════════════════════════════╝
  Set EMAIL_PROVIDER=smtp and configure SMTP_* vars for real email.
`);
    return Promise.resolve();
  }

  sendPasswordReset(opts: { to: string; token: string; appUrl: string }): Promise<void> {
    const link = `${opts.appUrl}/auth/reset-password?token=${encodeURIComponent(opts.token)}`;
    // eslint-disable-next-line no-console
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  EMAIL PROVIDER — FICTIONAL (console)                   ║
╠══════════════════════════════════════════════════════════╣
║  To:      ${opts.to.padEnd(46)}║
║  Subject: Reset your password                            ║
╠══════════════════════════════════════════════════════════╣
  Reset link:
  ${link}
╚══════════════════════════════════════════════════════════╝
`);
    return Promise.resolve();
  }

  send2FACode(opts: { to: string; code: string }): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  EMAIL PROVIDER — FICTIONAL (console)                   ║
╠══════════════════════════════════════════════════════════╣
║  To:      ${opts.to.padEnd(46)}║
║  Subject: Your sign-in verification code                 ║
╠══════════════════════════════════════════════════════════╣
  Your code: ${opts.code}   (expires in 5 minutes)
╚══════════════════════════════════════════════════════════╝
`);
    return Promise.resolve();
  }
}

class SmtpEmailProvider implements EmailProvider {
  async sendVerificationEmail(opts: {
    to: string;
    userId: string;
    token: string;
    appUrl: string;
  }): Promise<void> {
    // TODO: wire up nodemailer — install and import nodemailer, then:
    //   const transport = nodemailer.createTransport({ host: SMTP_HOST, ... })
    //   await transport.sendMail({ from: EMAIL_FROM, to: opts.to, subject: '...', html: '...' })
    const link = `${opts.appUrl}/auth/verify-email?token=${encodeURIComponent(opts.token)}`;
    // eslint-disable-next-line no-console
    console.log(`[SMTP stub] Would send verification email to ${opts.to}: ${link}`);
    await Promise.resolve();
  }

  async sendPasswordReset(opts: { to: string; token: string; appUrl: string }): Promise<void> {
    const link = `${opts.appUrl}/auth/reset-password?token=${encodeURIComponent(opts.token)}`;
    // eslint-disable-next-line no-console
    console.log(`[SMTP stub] Would send password reset to ${opts.to}: ${link}`);
    await Promise.resolve();
  }

  async send2FACode(opts: { to: string; code: string }): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[SMTP stub] Would send 2FA code ${opts.code} to ${opts.to}`);
    await Promise.resolve();
  }
}

let _provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (_provider) return _provider;
  _provider =
    getEnv().EMAIL_PROVIDER === 'smtp' ? new SmtpEmailProvider() : new ConsoleEmailProvider();
  return _provider;
}

export async function sendVerificationEmail(to: string, userId: string): Promise<void> {
  const token = `dev-token-${userId}`;
  // NEXT_PUBLIC_APP_URL is a client-side Next.js env var — accessed directly by convention
  // eslint-disable-next-line no-restricted-syntax
  const url = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000';
  await getEmailProvider().sendVerificationEmail({ to, userId, token, appUrl: url });
}
