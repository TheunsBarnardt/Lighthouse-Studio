/**
 * Client-side auth API calls — thin wrappers around the /api/v1/auth/* endpoints.
 */
import type { ApiError } from './types';

// eslint-disable-next-line no-restricted-syntax -- client-side only
const API_BASE = process.env['NEXT_PUBLIC_API_BASE_URL'] ?? '';

export class AuthApiError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(apiError: ApiError) {
    super(apiError.message);
    this.name = 'AuthApiError';
    this.code = apiError.code;
    this.statusCode = apiError.statusCode;
  }
}

async function authRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    let err: ApiError;
    try {
      const body = (await response.json()) as unknown;
      if (typeof body === 'object' && body !== null && 'code' in body && 'message' in body) {
        err = body as ApiError;
      } else {
        err = { code: 'UNKNOWN', message: `HTTP ${String(response.status)}`, statusCode: response.status };
      }
    } catch {
      err = { code: 'UNKNOWN', message: `HTTP ${String(response.status)}`, statusCode: response.status };
    }
    throw new AuthApiError(err);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export interface SignInInput {
  email: string;
  password: string;
  remember?: boolean;
}

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  captchaToken?: string;
}

export interface MeResponse {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  mfaEnabled: boolean;
  identities: Array<{ providerId: string; email: string; primary: boolean }>;
  preferences: Record<string, unknown>;
  avatarUrl: string | null;
}

export interface SessionInfo {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  isCurrent?: boolean;
}

export const authApi = {
  signIn(input: SignInInput): Promise<MeResponse> {
    return authRequest<MeResponse>('/api/v1/auth/sign-in', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  signUp(input: SignUpInput): Promise<{ message: string }> {
    return authRequest<{ message: string }>('/api/v1/auth/sign-up', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  signOut(): Promise<undefined> {
    return authRequest<undefined>('/api/v1/auth/sign-out', { method: 'POST' });
  },

  forgotPassword(email: string, captchaToken?: string): Promise<{ message: string }> {
    return authRequest<{ message: string }>('/api/v1/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email, captchaToken }),
    });
  },

  resetPassword(token: string, password: string): Promise<{ message: string }> {
    return authRequest<{ message: string }>('/api/v1/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  verifyEmail(token: string): Promise<{ message: string }> {
    return authRequest<{ message: string }>('/api/v1/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  requestMagicLink(email: string): Promise<{ message: string }> {
    return authRequest<{ message: string }>('/api/v1/auth/magic-link', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  consumeMagicLink(token: string): Promise<MeResponse> {
    return authRequest<MeResponse>(`/api/v1/auth/magic-link?token=${encodeURIComponent(token)}`);
  },

  mfaChallenge(challengeId: string, code: string): Promise<MeResponse> {
    return authRequest<MeResponse>('/api/v1/auth/mfa/challenge', {
      method: 'POST',
      body: JSON.stringify({ challengeId, code }),
    });
  },

  getMe(): Promise<MeResponse> {
    return authRequest<MeResponse>('/api/v1/me');
  },

  listSessions(): Promise<SessionInfo[]> {
    return authRequest<SessionInfo[]>('/api/v1/me/sessions');
  },

  revokeSession(sessionId: string): Promise<undefined> {
    return authRequest<undefined>(`/api/v1/me/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
  },

  revokeAllSessions(): Promise<undefined> {
    return authRequest<undefined>('/api/v1/me/sessions', { method: 'DELETE' });
  },

  validateInvitation(token: string): Promise<{ email: string; workspaceName: string; expiresAt: string }> {
    return authRequest<{ email: string; workspaceName: string; expiresAt: string }>(
      `/api/v1/auth/invitations/${encodeURIComponent(token)}/validate`,
    );
  },

  acceptInvitation(token: string): Promise<{ workspaceId: string; workspaceSlug: string }> {
    return authRequest<{ workspaceId: string; workspaceSlug: string }>(
      `/api/v1/auth/invitations/${encodeURIComponent(token)}/accept`,
      { method: 'POST' },
    );
  },

  getSetupStatus(): Promise<{ initialized: boolean }> {
    return authRequest<{ initialized: boolean }>('/api/v1/setup/status');
  },

  runSetup(input: { email: string; password: string; displayName: string; workspaceName: string }): Promise<MeResponse> {
    return authRequest<MeResponse>('/api/v1/setup', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};
