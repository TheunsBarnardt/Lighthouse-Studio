'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';

export default function MfaPage() {
  const t = useTranslations('account.mfa');
  const { user, refresh } = useAuth();
  const [enrolling, setEnrolling] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [savedCodes, setSavedCodes] = useState(false);

  // Fake TOTP URI for dev (real implementation would generate from the MFA adapter)
  const totpUri = user
    ? `otpauth://totp/LighthouseStudio:${user.email}?secret=JBSWY3DPEHPK3PXP&issuer=LighthouseStudio`
    : '';

  function startEnroll() {
    setEnrolling(true);
    setCode('');
    setCodeError(null);
  }

  async function submitCode() {
    if (code.length < 6) {
      setCodeError('Enter a 6-digit code from your authenticator.');
      return;
    }
    // TODO: verify TOTP and enable MFA via /api/v1/me/mfa
    const fakeCodes = Array.from(
      { length: 10 },
      () => `${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}`,
    );
    setRecoveryCodes(fakeCodes);
    await refresh();
  }

  function downloadCodes() {
    if (!recoveryCodes) return;
    const blob = new Blob([recoveryCodes.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lighthouse-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (recoveryCodes) {
    return (
      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <h2 className="text-sm font-semibold">{t('recoveryCodes')}</h2>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--border-default)',
              fontSize: '0.875rem',
            }}
          >
            {t('recoveryCodesInfo')}
          </div>

          <div
            className="font-mono text-sm"
            style={{
              borderRadius: '6px',
              border: '1px solid var(--border-default)',
              padding: '1rem',
              fontSize: '0.875rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
            }}
          >
            {recoveryCodes.map((c) => (
              <div key={c}>{c}</div>
            ))}
          </div>

          <div>
            <Button variant="outline" type="button" onClick={downloadCodes}>
              {t('downloadCodes')}
            </Button>
          </div>

          <label
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
          >
            <input
              type="checkbox"
              id="saved-codes"
              checked={savedCodes}
              onChange={(e) => {
                setSavedCodes(e.target.checked);
              }}
              style={{ width: '1rem', height: '1rem', accentColor: 'var(--accent-primary)' }}
            />
            <span style={{ fontSize: '0.875rem' }}>{t('savedCodes')}</span>
          </label>

          {savedCodes && (
            <div>
              <Button
                type="button"
                onClick={() => {
                  setRecoveryCodes(null);
                  setEnrolling(false);
                }}
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (enrolling) {
    return (
      <div className="rounded-md border bg-card text-card-foreground p-4">
        <div className="mb-3 flex items-center justify-between border-b pb-3">
          <h2 className="text-sm font-semibold">{t('enrollTitle')}</h2>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.875rem' }}>{t('enrollStep1')}</p>

          {/* QR code placeholder — real impl uses a QR library */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '12rem',
              width: '12rem',
              borderRadius: '8px',
              border: '1px solid var(--border-default)',
              fontSize: '0.75rem',
              textAlign: 'center',
              gap: '0.25rem',
              padding: '0.75rem',
            }}
          >
            <span>QR code for authenticator</span>
            <span style={{ wordBreak: 'break-all' }}>{totpUri.slice(0, 40)}…</span>
          </div>

          <p style={{ fontSize: '0.875rem' }}>{t('enrollStep2')}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label htmlFor="mfa-code" style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
              {t('enrollCodeLabel')}
            </label>
            <input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeError(null);
              }}
              aria-required
              style={{
                padding: '0.4375rem 0.75rem',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                fontSize: '0.875rem',
                outline: 'none',
                maxWidth: '12rem',
              }}
            />
            {codeError && <span style={{ fontSize: '0.8125rem' }}>{codeError}</span>}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              type="button"
              onClick={() => {
                void submitCode();
              }}
            >
              {t('enrollSubmit')}
            </Button>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setEnrolling(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card text-card-foreground p-4">
      <div className="mb-3 flex items-center justify-between border-b pb-3">
        <h2 className="text-sm font-semibold">{t('title')}</h2>
      </div>
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            border: '1px solid var(--border-default)',
            fontSize: '0.875rem',
          }}
        >
          {user?.mfaEnabled ? t('enabled') : t('disabled')}
        </div>

        {!user?.mfaEnabled && (
          <div>
            <Button type="button" onClick={startEnroll}>
              {t('enable')}
            </Button>
          </div>
        )}
        {user?.mfaEnabled && (
          <div>
            <Button
              type="button"
              style={{ background: 'var(--fg-danger)', borderColor: 'var(--fg-danger)' }}
              onClick={() => {
                /* TODO */
              }}
            >
              {t('disable')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
