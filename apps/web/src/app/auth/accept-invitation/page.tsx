'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/auth-context';
import { AuthApiError, authApi } from '@/lib/auth-client';

interface InvitationInfo {
  email: string;
  workspaceName: string;
  expiresAt: string;
}

function AcceptInvitationPageInner() {
  const t = useTranslations('auth.acceptInvitation');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { user } = useAuth();

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [success, setSuccess] = useState<{ workspaceSlug: string; workspaceName: string } | null>(
    null,
  );

  useEffect(() => {
    if (!token) {
      setError('No invitation token found.');
      setLoading(false);
      return;
    }
    void authApi
      .validateInvitation(token)
      .then((inv) => {
        setInvitation(inv);
        return inv;
      })
      .catch((err: unknown) => {
        if (err instanceof AuthApiError) {
          setError(err.statusCode === 404 ? t('expired') : err.message);
        } else {
          setError('Failed to validate invitation.');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token, t]);

  async function handleAccept() {
    setAccepting(true);
    try {
      const result = await authApi.acceptInvitation(token);
      setSuccess({
        workspaceSlug: result.workspaceSlug,
        workspaceName: invitation?.workspaceName ?? '',
      });
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Failed to accept invitation.');
    } finally {
      setAccepting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {t('loading')}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('success', { workspaceName: success.workspaceName })}</CardTitle>
        </CardHeader>
        <CardFooter className="justify-center">
          <Link href={`/workspaces/${success.workspaceSlug}`}>
            <Button>{t('goToWorkspace')}</Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {invitation && !error && (
          <>
            <p className="text-sm">{t('invitedTo', { workspaceName: invitation.workspaceName })}</p>
            {user && (
              <p className="text-sm text-muted-foreground">
                {t('signedInAs', { email: user.email })}
              </p>
            )}
            {!user && (
              <p className="text-sm text-muted-foreground">
                Sign in first to accept this invitation.{' '}
                <Link
                  href={`/auth/sign-in?returnTo=/auth/accept-invitation?token=${token}`}
                  className="text-primary hover:underline"
                >
                  Sign in
                </Link>
              </p>
            )}
          </>
        )}
      </CardContent>
      {invitation && !error && user && (
        <CardFooter>
          <Button
            className="w-full"
            onClick={() => {
              void handleAccept();
            }}
            disabled={accepting}
          >
            {accepting ? t('accepting') : t('accept')}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense>
      <AcceptInvitationPageInner />
    </Suspense>
  );
}
