'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const totpUri = user ? `otpauth://totp/LighthouseStudio:${user.email}?secret=JBSWY3DPEHPK3PXP&issuer=LighthouseStudio` : '';

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
    const fakeCodes = Array.from({ length: 10 }, () =>
      `${Math.random().toString(36).slice(2, 6)}-${Math.random().toString(36).slice(2, 6)}`
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
      <Card>
        <CardHeader><CardTitle>{t('recoveryCodes')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>{t('recoveryCodesInfo')}</AlertDescription>
          </Alert>
          <div className="rounded-md bg-muted p-4 font-mono text-sm">
            {recoveryCodes.map((code) => <div key={code}>{code}</div>)}
          </div>
          <Button variant="outline" onClick={downloadCodes}>{t('downloadCodes')}</Button>
          <div className="flex items-center gap-2">
            <Checkbox
              id="saved-codes"
              checked={savedCodes}
              onCheckedChange={(v) => { setSavedCodes(!!v); }}
            />
            <Label htmlFor="saved-codes">{t('savedCodes')}</Label>
          </div>
          {savedCodes && (
            <Button onClick={() => { setRecoveryCodes(null); setEnrolling(false); }}>
              Done
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (enrolling) {
    return (
      <Card>
        <CardHeader><CardTitle>{t('enrollTitle')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('enrollStep1')}</p>
          {/* QR code placeholder — real impl uses a QR library */}
          <div className="flex h-48 w-48 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">
            QR code for authenticator
            <br />
            <span className="break-all">{totpUri.slice(0, 40)}…</span>
          </div>
          <p className="text-sm text-muted-foreground">{t('enrollStep2')}</p>
          <div className="space-y-1">
            <Label htmlFor="mfa-code">{t('enrollCodeLabel')}</Label>
            <Input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => { setCode(e.target.value); setCodeError(null); }}
              aria-required
            />
            {codeError && <p className="text-sm text-destructive">{codeError}</p>}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => { void submitCode(); }}>{t('enrollSubmit')}</Button>
            <Button variant="outline" onClick={() => { setEnrolling(false); }}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>{t('title')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            {user?.mfaEnabled ? t('enabled') : t('disabled')}
          </AlertDescription>
        </Alert>
        {!user?.mfaEnabled && (
          <Button onClick={startEnroll}>{t('enable')}</Button>
        )}
        {user?.mfaEnabled && (
          <Button variant="destructive" onClick={() => { /* TODO */ }}>{t('disable')}</Button>
        )}
      </CardContent>
    </Card>
  );
}
