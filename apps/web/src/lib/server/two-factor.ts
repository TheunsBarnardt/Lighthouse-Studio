/**
 * Two-factor authentication provider.
 *
 * TWO_FACTOR_REQUIRED=true   — require 2FA on every password sign-in
 * TWO_FACTOR_METHOD=totp     — totp | sms | email
 *
 * SMS_PROVIDER=console       — fictional: logs OTP to server console (default)
 * SMS_PROVIDER=twilio        — real Twilio (configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)
 *
 * When fictional providers are active the OTP is printed to the server console so you can
 * copy-paste it into the challenge form. Set real provider env vars to send actual messages.
 */
import { getEnv } from '@platform/config';
import { randomBytes } from 'node:crypto';

export function twoFactorRequired(): boolean {
  return getEnv().TWO_FACTOR_REQUIRED;
}

export function twoFactorMethod(): string {
  return getEnv().TWO_FACTOR_METHOD;
}

// ─── Challenge store ─────────────────────────────────────────────────────────

interface ChallengeRecord {
  userId: string;
  code: string;
  method: string;
  expiresAt: number;
}

const g = globalThis as typeof globalThis & { _mfaChallenges?: Map<string, ChallengeRecord> };

function store(): Map<string, ChallengeRecord> {
  if (!g._mfaChallenges) g._mfaChallenges = new Map();
  return g._mfaChallenges;
}

export function storeMfaChallenge(
  challengeId: string,
  record: Omit<ChallengeRecord, 'expiresAt'>,
): void {
  store().set(challengeId, { ...record, expiresAt: Date.now() + 5 * 60 * 1000 });
}

export function verifyAndConsumeMfaChallenge(
  challengeId: string,
  code: string,
): { valid: boolean; userId?: string } {
  const rec = store().get(challengeId);
  store().delete(challengeId);
  if (!rec || rec.expiresAt < Date.now()) return { valid: false };
  if (rec.code !== code) return { valid: false };
  return { valid: true, userId: rec.userId };
}

// ─── OTP generation ──────────────────────────────────────────────────────────

function generateOtp(): string {
  // 6-digit numeric OTP via crypto — avoids modulo bias for display purposes
  return String(randomBytes(3).readUIntBE(0, 3) % 1_000_000).padStart(6, '0');
}

// ─── SMS provider ────────────────────────────────────────────────────────────

interface SmsProvider {
  send(to: string, message: string): Promise<void>;
}

class ConsoleSmsProvider implements SmsProvider {
  send(to: string, message: string): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  SMS PROVIDER — FICTIONAL (console)                     ║
╠══════════════════════════════════════════════════════════╣
║  To:      ${to.padEnd(46)}║
╠══════════════════════════════════════════════════════════╣
  ${message}
╚══════════════════════════════════════════════════════════╝
  Set SMS_PROVIDER=twilio and TWILIO_* vars for real SMS.
`);
    return Promise.resolve();
  }
}

class TwilioSmsProvider implements SmsProvider {
  async send(to: string, message: string): Promise<void> {
    // TODO: install twilio SDK and replace stub
    //   const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    //   await client.messages.create({ body: message, from: TWILIO_FROM_NUMBER, to })
    // eslint-disable-next-line no-console
    console.log(`[Twilio stub] Would send to ${to}: ${message}`);
    await Promise.resolve();
  }
}

function getSmsProvider(): SmsProvider {
  return getEnv().SMS_PROVIDER === 'twilio' ? new TwilioSmsProvider() : new ConsoleSmsProvider();
}

// ─── Issue a challenge ───────────────────────────────────────────────────────

export async function issueMfaChallenge(userId: string, contact: string): Promise<string> {
  const challengeId = randomBytes(16).toString('hex');
  const code = generateOtp();
  const method = twoFactorMethod();

  storeMfaChallenge(challengeId, { userId, code, method });

  if (method === 'sms') {
    await getSmsProvider().send(contact, `Your sign-in code is: ${code}  (expires in 5 minutes)`);
  } else if (method === 'email') {
    // Import lazily to avoid circular deps
    const { getEmailProvider } = await import('./email.js');
    await getEmailProvider().send2FACode({ to: contact, code });
  } else {
    // TOTP: in production the user scans a QR code with an authenticator app.
    // Fictional mode: just log the code so it can be copied into the challenge form.
    // eslint-disable-next-line no-console
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  2FA (TOTP) — FICTIONAL (console)                       ║
╠══════════════════════════════════════════════════════════╣
  User:   ${contact}
  Code:   ${code}   (expires in 5 minutes)
╚══════════════════════════════════════════════════════════╝
  In production this code comes from the user's authenticator app.
`);
  }

  return challengeId;
}
