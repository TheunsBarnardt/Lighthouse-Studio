'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

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
      <div className="pg-card">
        <div className="pg-card-header">
          <h2 className="pg-card-title">{t('recoveryCodes')}</h2>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              border: '1px solid var(--border-default)',
              fontSize: '0.875rem',
              color: 'var(--fg-secondary)',
            }}
          >
            {t('recoveryCodesInfo')}
          </div>

          <div
            className="pg-mono"
            style={{
              borderRadius: '6px',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-canvas)',
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
            <button type="button" className="pg-btn pg-btn-secondary" onClick={downloadCodes}>
              {t('downloadCodes')}
            </button>
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
            <span style={{ fontSize: '0.875rem', color: 'var(--fg-primary)' }}>
              {t('savedCodes')}
            </span>
          </label>

          {savedCodes && (
            <div>
              <button
                type="button"
                className="pg-btn pg-btn-primary"
                onClick={() => {
                  setRecoveryCodes(null);
                  setEnrolling(false);
                }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (enrolling) {
    return (
      <div className="pg-card">
        <div className="pg-card-header">
          <h2 className="pg-card-title">{t('enrollTitle')}</h2>
        </div>
        <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--fg-secondary)' }}>{t('enrollStep1')}</p>

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
              background: 'var(--bg-canvas)',
              fontSize: '0.75rem',
              color: 'var(--fg-tertiary)',
              textAlign: 'center',
              gap: '0.25rem',
              padding: '0.75rem',
            }}
          >
            <span>QR code for authenticator</span>
            <span style={{ wordBreak: 'break-all' }}>{totpUri.slice(0, 40)}…</span>
          </div>

          <p style={{ fontSize: '0.875rem', color: 'var(--fg-secondary)' }}>{t('enrollStep2')}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <label
              htmlFor="mfa-code"
              style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--fg-primary)' }}
            >
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
                background: 'var(--bg-canvas)',
                color: 'var(--fg-primary)',
                fontSize: '0.875rem',
                outline: 'none',
                maxWidth: '12rem',
              }}
            />
            {codeError && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--fg-danger)' }}>{codeError}</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="pg-btn pg-btn-primary"
              onClick={() => {
                void submitCode();
              }}
            >
              {t('enrollSubmit')}
            </button>
            <button
              type="button"
              className="pg-btn pg-btn-secondary"
              onClick={() => {
                setEnrolling(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pg-card">
      <div className="pg-card-header">
        <h2 className="pg-card-title">{t('title')}</h2>
      </div>
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            border: '1px solid var(--border-default)',
            fontSize: '0.875rem',
            color: 'var(--fg-secondary)',
          }}
        >
          {user?.mfaEnabled ? t('enabled') : t('disabled')}
        </div>

        {!user?.mfaEnabled && (
          <div>
            <button type="button" className="pg-btn pg-btn-primary" onClick={startEnroll}>
              {t('enable')}
            </button>
          </div>
        )}
        {user?.mfaEnabled && (
          <div>
            <button
              type="button"
              className="pg-btn pg-btn-primary"
              style={{ background: 'var(--fg-danger)', borderColor: 'var(--fg-danger)' }}
              onClick={() => {
                /* TODO */
              }}
            >
              {t('disable')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
