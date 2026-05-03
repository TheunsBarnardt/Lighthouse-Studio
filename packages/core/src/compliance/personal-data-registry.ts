// ── Personal Data Registry ────────────────────────────────────────────────────
//
// Machine-readable enumeration of every place the platform stores PII.
// This registry drives:
//   - Data subject access exports (GDPR Article 15)
//   - Erasure handling (GDPR Article 17)
//   - The auto-generated compliance document docs/compliance/personal-data-registry.md
//   - Privacy notice templates
//
// When adding a feature that stores PII, update this registry in the same PR.
// CI will warn (soft check) when new PII-named columns are added without a registry update.

export type PersonalDataCategory =
  | 'identity'
  | 'contact'
  | 'authentication'
  | 'preference'
  | 'forensic'
  | 'usage'
  | 'communication';

export type LegalBasis =
  | 'contract'
  | 'consent'
  | 'legitimate_interest'
  | 'legal_obligation'
  | 'vital_interest'
  | 'public_task';

export interface PersonalDataRecord {
  /** Dot-path to the field. e.g. 'users.primary_email' or 'audit_log.actor_email_snapshot'. */
  location: string;
  category: PersonalDataCategory;
  /** Why the platform collects this data. */
  purpose: string;
  legal_basis: LegalBasis;
  /** Human-readable retention period. */
  retention: string;
  /** Can this field be deleted/anonymized on an erasure request? */
  eraseable: boolean;
  /** How to erase: delete the row or anonymize the field. */
  erasure_method?: 'delete' | 'anonymize';
  notes?: string;
}

export const personalDataRegistry: PersonalDataRecord[] = [
  // ── User directory ──────────────────────────────────────────────────────────
  {
    location: 'users.primary_email',
    category: 'contact',
    purpose: 'authentication, communication, invitation delivery',
    legal_basis: 'contract',
    retention: 'until account deletion + 30 days grace period',
    eraseable: true,
    erasure_method: 'anonymize',
    notes:
      'Anonymized to deterministic hash on erasure so audit events referencing the user id remain intact.',
  },
  {
    location: 'users.display_name',
    category: 'identity',
    purpose: 'user interface display',
    legal_basis: 'contract',
    retention: 'until account deletion + 30 days grace period',
    eraseable: true,
    erasure_method: 'anonymize',
  },
  {
    location: 'users.avatar_url',
    category: 'identity',
    purpose: 'user interface display',
    legal_basis: 'contract',
    retention: 'until account deletion + 30 days grace period',
    eraseable: true,
    erasure_method: 'delete',
  },
  {
    location: 'users.preferences',
    category: 'preference',
    purpose: 'personalising the platform experience',
    legal_basis: 'contract',
    retention: 'until account deletion + 30 days grace period',
    eraseable: true,
    erasure_method: 'delete',
  },

  // ── Identity / authentication ───────────────────────────────────────────────
  {
    location: 'user_credentials.password_hash',
    category: 'authentication',
    purpose: 'password-based authentication',
    legal_basis: 'contract',
    retention: 'until account deletion + 30 days grace period',
    eraseable: true,
    erasure_method: 'delete',
  },
  {
    location: 'user_credentials.mfa_totp_secret',
    category: 'authentication',
    purpose: 'TOTP multi-factor authentication',
    legal_basis: 'contract',
    retention: 'until account deletion + 30 days grace period',
    eraseable: true,
    erasure_method: 'delete',
  },
  {
    location: 'user_credentials.recovery_codes',
    category: 'authentication',
    purpose: 'MFA recovery',
    legal_basis: 'contract',
    retention: 'until account deletion + 30 days grace period',
    eraseable: true,
    erasure_method: 'delete',
  },
  {
    location: 'sessions.user_id',
    category: 'authentication',
    purpose: 'session tracking for authenticated requests',
    legal_basis: 'contract',
    retention: 'until session expiry',
    eraseable: true,
    erasure_method: 'delete',
    notes: 'All sessions are revoked as part of the erasure workflow.',
  },
  {
    location: 'external_identities.provider_subject',
    category: 'authentication',
    purpose: 'OAuth / OIDC / SAML identity linkage',
    legal_basis: 'contract',
    retention: 'until account deletion + 30 days grace period',
    eraseable: true,
    erasure_method: 'delete',
  },

  // ── Workspace membership ────────────────────────────────────────────────────
  {
    location: 'workspace_members.user_id',
    category: 'identity',
    purpose: 'workspace access control and attribution',
    legal_basis: 'contract',
    retention: 'until workspace deletion or member removal + installation retention policy',
    eraseable: true,
    erasure_method: 'anonymize',
    notes:
      'Anonymized to a consistent placeholder so historical workspace membership records remain structurally valid.',
  },
  {
    location: 'workspace_invitations.email',
    category: 'contact',
    purpose: 'invitation delivery and deduplication',
    legal_basis: 'legitimate_interest',
    retention: 'until invitation expiry or acceptance + 90 days',
    eraseable: true,
    erasure_method: 'delete',
  },

  // ── Audit log ───────────────────────────────────────────────────────────────
  {
    location: 'audit_log.actor_id',
    category: 'forensic',
    purpose: 'forensic record of actions performed on the platform',
    legal_basis: 'legal_obligation',
    retention: '7 years (configurable; minimum 90 days)',
    eraseable: false,
    notes:
      'Actor ID is retained in audit events even after user erasure. The user record is anonymized; ' +
      'the audit events keep the original ID, which now points to no user record. ' +
      'This preserves forensic integrity without exposing identity.',
  },
  {
    location: 'audit_log.actor_email_snapshot',
    category: 'contact',
    purpose: 'forensic record — email at the time of the event',
    legal_basis: 'legal_obligation',
    retention: '7 years (configurable)',
    eraseable: false,
    notes:
      'Email snapshot is captured at event time for forensic value. ' +
      'On erasure, the snapshot is NOT deleted (audit integrity) but the user directory ' +
      'record is anonymized, so correlation is broken for non-auditor roles.',
  },
  {
    location: 'audit_log.ip_address',
    category: 'usage',
    purpose: 'security forensics, abuse detection',
    legal_basis: 'legitimate_interest',
    retention: '7 years (configurable)',
    eraseable: false,
    notes: 'IP addresses are retained for security forensics per legitimate interest.',
  },
];
