'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { AuthApiError, authApi } from '@/lib/auth-client';

interface InvitationInfo {
  email: string;
  workspaceName: string;
  expiresAt: string;
}

const cardStyle: React.CSSProperties = {
  maxWidth: 480,
  margin: '64px auto',
  padding: '32px',
};

function AcceptInvitationPageInner() {
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
          setError(
            err.statusCode === 404 ? 'This invitation has expired or is invalid.' : err.message,
          );
        } else {
          setError('Failed to validate invitation.');
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

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
      <div className="rounded-md border bg-card text-card-foreground p-4" style={cardStyle}>
        <p style={{ fontSize: 13 }} aria-live="polite">
          Validating invitation…
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="rounded-md border bg-card text-card-foreground p-4" style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
          You've joined {success.workspaceName}!
        </h2>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Link
            href={`/workspaces/${success.workspaceSlug}`}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to workspace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card text-card-foreground p-4" style={cardStyle}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Workspace invitation</h2>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            borderRadius: 4,
            background: 'var(--bg-danger-subtle)',
            padding: '10px 12px',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {invitation && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13 }}>
            You've been invited to join <strong>{invitation.workspaceName}</strong>.
          </p>
          {user ? (
            <p style={{ fontSize: 13 }}>Signed in as {user.email}</p>
          ) : (
            <p style={{ fontSize: 13 }}>
              Sign in first to accept this invitation.{' '}
              <Link
                href={`/auth/sign-in?returnTo=/auth/accept-invitation?token=${token}`}
                style={{ textDecoration: 'none' }}
              >
                Sign in
              </Link>
            </p>
          )}
          {user && (
            <Button
              type="button"
              style={{ width: '100%' }}
              onClick={() => {
                void handleAccept();
              }}
              disabled={accepting}
            >
              {accepting ? 'Accepting…' : 'Accept invitation'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense>
      <AcceptInvitationPageInner />
    </Suspense>
  );
}
