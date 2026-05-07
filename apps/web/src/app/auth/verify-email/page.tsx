'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { authApi } from '@/lib/auth-client';

function VerifyEmailPageInner() {
  const t = useTranslations('auth.verifyEmail');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }
    void authApi
      .verifyEmail(token)
      .then(() => {
        setStatus('success');
        return undefined;
      })
      .catch(() => {
        setStatus('error');
      });
  }, [token]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {status === 'verifying' && t('title')}
          {status === 'success' && t('successTitle')}
          {status === 'error' && 'Verification failed'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {status === 'verifying' && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Verifying…
          </p>
        )}
        {status === 'success' && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t('successMessage')}
          </p>
        )}
        {status === 'error' && (
          <Alert variant="destructive" aria-live="polite">
            <AlertDescription>{t('invalidToken')}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      {status === 'success' && (
        <CardFooter className="justify-center">
          <Link href="/auth/sign-in">
            <Button>{t('signIn')}</Button>
          </Link>
        </CardFooter>
      )}
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailPageInner />
    </Suspense>
  );
}
