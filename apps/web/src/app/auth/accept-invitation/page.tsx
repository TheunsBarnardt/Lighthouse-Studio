'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

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
      <div className="pg-card" style={cardStyle}>
        <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }} aria-live="polite">
          Validating invitation…
        </p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="pg-card" style={cardStyle}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg-primary)', marginBottom: 16 }}>
          You've joined {success.workspaceName}!
        </h2>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Link href={`/workspaces/${success.workspaceSlug}`} className="pg-btn pg-btn-primary">
            Go to workspace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pg-card" style={cardStyle}>
      <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg-primary)', marginBottom: 16 }}>
        Workspace invitation
      </h2>

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: 16,
            borderRadius: 4,
            background: 'var(--bg-danger-subtle)',
            padding: '10px 12px',
            fontSize: 13,
            color: 'var(--fg-danger)',
          }}
        >
          {error}
        </div>
      )}

      {invitation && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--fg-primary)' }}>
            You've been invited to join <strong>{invitation.workspaceName}</strong>.
          </p>
          {user ? (
            <p style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>Signed in as {user.email}</p>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>
              Sign in first to accept this invitation.{' '}
              <Link
                href={`/auth/sign-in?returnTo=/auth/accept-invitation?token=${token}`}
                style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}
              >
                Sign in
              </Link>
            </p>
          )}
          {user && (
            <button
              className="pg-btn pg-btn-primary"
              style={{ width: '100%' }}
              onClick={() => {
                void handleAccept();
              }}
              disabled={accepting}
            >
              {accepting ? 'Accepting…' : 'Accept invitation'}
            </button>
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
