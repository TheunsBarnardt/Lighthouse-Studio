import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';
import type { RepositoryPort } from '@platform/ports-persistence';

import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

import type { AppError } from '../errors.js';

import { auditMeta, toAuditActor } from '../context.js';
import { ForbiddenError, ValidationError, WorkspaceContextRequiredError } from '../errors.js';
import { observable } from '../observability/observable.js';

export type TemplateKey =
  | 'email_verification'
  | 'welcome'
  | 'password_reset'
  | 'magic_link'
  | 'workspace_invitation'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'email_changed'
  | 'password_changed'
  | 'new_device_sign_in'
  | 'account_deletion';

export const TEMPLATE_KEYS: TemplateKey[] = [
  'email_verification',
  'welcome',
  'password_reset',
  'magic_link',
  'workspace_invitation',
  'mfa_enabled',
  'mfa_disabled',
  'email_changed',
  'password_changed',
  'new_device_sign_in',
  'account_deletion',
];

export interface TemplateContext {
  /** User's display name or email */
  recipientName?: string;
  /** Platform or workspace name */
  platformName?: string;
  /** Primary action URL (verification link, reset link, etc.) */
  actionUrl?: string;
  /** Token expiry string */
  expiresIn?: string;
  /** Workspace name for invitation emails */
  workspaceName?: string;
  /** IP address for security alert emails */
  ipAddress?: string;
  /** Device string for new device sign-in */
  device?: string;
  [key: string]: string | undefined;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface TemplateOverride {
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate?: string;
}

export interface WorkspaceEmailTemplateRecord {
  id: string;
  version: number;
  workspaceId: string;
  templateKey: TemplateKey;
  subjectTemplate: string;
  htmlTemplate: string;
  textTemplate: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
}

type TemplateRepo = RepositoryPort<WorkspaceEmailTemplateRecord>;

const TemplateKeySchema = z.enum([
  'email_verification',
  'welcome',
  'password_reset',
  'magic_link',
  'workspace_invitation',
  'mfa_enabled',
  'mfa_disabled',
  'email_changed',
  'password_changed',
  'new_device_sign_in',
  'account_deletion',
]);

export class EmailTemplateService {
  readonly render!: (
    ctx: RequestContext,
    templateKey: TemplateKey,
    context: TemplateContext,
    workspaceId?: string,
  ) => Promise<Result<RenderedEmail, AppError>>;

  readonly setTemplateOverride!: (
    ctx: RequestContext,
    workspaceId: string,
    templateKey: TemplateKey,
    template: TemplateOverride,
  ) => Promise<Result<void, AppError>>;

  readonly resetTemplateOverride!: (
    ctx: RequestContext,
    workspaceId: string,
    templateKey: TemplateKey,
  ) => Promise<Result<void, AppError>>;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly repo: TemplateRepo,
    private readonly audit: AuditPort,
    logger: LoggerPort,
  ) {
    const obs = { logger };
    const s = 'EmailTemplateService';
    this.render = observable(s, 'render', obs, this._render.bind(this));
    this.setTemplateOverride = observable(
      s,
      'setTemplateOverride',
      obs,
      this._setTemplateOverride.bind(this),
    );
    this.resetTemplateOverride = observable(
      s,
      'resetTemplateOverride',
      obs,
      this._resetTemplateOverride.bind(this),
    );
  }

  private async _render(
    _ctx: RequestContext,
    templateKey: TemplateKey,
    context: TemplateContext,
    workspaceId?: string,
  ): Promise<Result<RenderedEmail, AppError>> {
    // 1. Check for workspace override
    if (workspaceId) {
      const override = await this.repo.findOne({
        _and: [{ workspaceId: { _eq: workspaceId } }, { templateKey: { _eq: templateKey } }],
      } as Parameters<TemplateRepo['findOne']>[0]);

      if (override.isOk() && override.value) {
        return ok({
          subject: this._interpolate(override.value.subjectTemplate, context),
          html: this._interpolate(override.value.htmlTemplate, context),
          text: override.value.textTemplate
            ? this._interpolate(override.value.textTemplate, context)
            : this._htmlToText(this._interpolate(override.value.htmlTemplate, context)),
        });
      }
    }

    // 2. Fall back to default template
    const defaultTemplate = DEFAULT_TEMPLATES[templateKey];

    return ok({
      subject: this._interpolate(defaultTemplate.subject, context),
      html: this._interpolate(defaultTemplate.html, context),
      text: this._interpolate(defaultTemplate.text, context),
    });
  }

  private async _setTemplateOverride(
    ctx: RequestContext,
    workspaceId: string,
    templateKey: TemplateKey,
    template: TemplateOverride,
  ): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const parsedKey = TemplateKeySchema.safeParse(templateKey);
    if (!parsedKey.success) return err(new ValidationError('Invalid template key'));

    const authResult = await this.authz.authorize(
      ctx,
      'workspace.manage_email_templates',
      'workspace',
    );
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const now = new Date();
    const existing = await this.repo.findOne({
      _and: [{ workspaceId: { _eq: workspaceId } }, { templateKey: { _eq: templateKey } }],
    } as Parameters<TemplateRepo['findOne']>[0]);

    if (existing.isOk() && existing.value) {
      await this.repo.update(
        existing.value.id,
        {
          subjectTemplate: template.subjectTemplate,
          htmlTemplate: template.htmlTemplate,
          textTemplate: template.textTemplate ?? null,
          updatedBy: ctx.userId,
          updatedAt: now,
        } as Partial<WorkspaceEmailTemplateRecord>,
        { expectedVersion: existing.value.version },
      );
    } else {
      await this.repo.create({
        id: crypto.randomUUID(),
        version: 1,
        workspaceId,
        templateKey,
        subjectTemplate: template.subjectTemplate,
        htmlTemplate: template.htmlTemplate,
        textTemplate: template.textTemplate ?? null,
        createdAt: now,
        updatedAt: now,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      } as WorkspaceEmailTemplateRecord);
    }

    await this.audit.write({
      eventType: 'data_management.workspace.email_template_overridden',
      workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'email_template', id: templateKey },
      action: 'email_template_overridden',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { templateKey },
      ...auditMeta(ctx),
    });

    return ok(undefined);
  }

  private async _resetTemplateOverride(
    ctx: RequestContext,
    workspaceId: string,
    templateKey: TemplateKey,
  ): Promise<Result<void, AppError>> {
    if (!ctx.workspaceId) return err(new WorkspaceContextRequiredError());

    const authResult = await this.authz.authorize(
      ctx,
      'workspace.manage_email_templates',
      'workspace',
    );
    if (authResult.isErr()) return err(new ForbiddenError(authResult.error.message));

    const existing = await this.repo.findOne({
      _and: [{ workspaceId: { _eq: workspaceId } }, { templateKey: { _eq: templateKey } }],
    } as Parameters<TemplateRepo['findOne']>[0]);

    if (existing.isOk() && existing.value) {
      await this.repo.archive(existing.value.id);
    }

    await this.audit.write({
      eventType: 'data_management.workspace.email_template_reset',
      workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'email_template', id: templateKey },
      action: 'email_template_reset',
      outcome: 'success',
      correlationId: ctx.correlationId,
      metadata: { templateKey },
      ...auditMeta(ctx),
    });

    return ok(undefined);
  }

  private _interpolate(template: string, ctx: TemplateContext): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => ctx[key] ?? '');
  }

  private _htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// ── Default templates ─────────────────────────────────────────────────────────

interface DefaultTemplate {
  subject: string;
  html: string;
  text: string;
}

const DEFAULT_TEMPLATES: Record<TemplateKey, DefaultTemplate> = {
  email_verification: {
    subject: 'Verify your email address — {{platformName}}',
    html: `<p>Hi {{recipientName}},</p><p>Click the link below to verify your email address:</p><p><a href="{{actionUrl}}">Verify email</a></p><p>This link expires in {{expiresIn}}.</p>`,
    text: `Hi {{recipientName}},\n\nVerify your email: {{actionUrl}}\n\nThis link expires in {{expiresIn}}.`,
  },
  welcome: {
    subject: 'Welcome to {{platformName}}!',
    html: `<p>Hi {{recipientName}},</p><p>Your account has been verified. Welcome to {{platformName}}!</p>`,
    text: `Hi {{recipientName}},\n\nWelcome to {{platformName}}! Your account is ready.`,
  },
  password_reset: {
    subject: 'Reset your password — {{platformName}}',
    html: `<p>Hi {{recipientName}},</p><p>Click below to reset your password:</p><p><a href="{{actionUrl}}">Reset password</a></p><p>If you did not request this, ignore this email. This link expires in {{expiresIn}}.</p>`,
    text: `Reset your password: {{actionUrl}}\n\nExpires in {{expiresIn}}.`,
  },
  magic_link: {
    subject: 'Sign in to {{platformName}}',
    html: `<p>Hi {{recipientName}},</p><p>Click below to sign in:</p><p><a href="{{actionUrl}}">Sign in</a></p><p>This link expires in {{expiresIn}}.</p>`,
    text: `Sign in: {{actionUrl}}\n\nExpires in {{expiresIn}}.`,
  },
  workspace_invitation: {
    subject: "You've been invited to join {{workspaceName}}",
    html: `<p>Hi,</p><p>You've been invited to join <strong>{{workspaceName}}</strong> on {{platformName}}.</p><p><a href="{{actionUrl}}">Accept invitation</a></p><p>This invitation expires in {{expiresIn}}.</p>`,
    text: `You've been invited to {{workspaceName}}.\n\nAccept: {{actionUrl}}\n\nExpires in {{expiresIn}}.`,
  },
  mfa_enabled: {
    subject: 'Two-factor authentication enabled — {{platformName}}',
    html: `<p>Hi {{recipientName}},</p><p>Two-factor authentication has been enabled on your account.</p>`,
    text: `Hi {{recipientName}},\n\nTwo-factor authentication has been enabled on your account.`,
  },
  mfa_disabled: {
    subject: 'Two-factor authentication disabled — {{platformName}}',
    html: `<p>Hi {{recipientName}},</p><p>Two-factor authentication has been disabled on your account. If you did not do this, contact your administrator immediately.</p>`,
    text: `Hi {{recipientName}},\n\nTwo-factor authentication was disabled. If you didn't do this, contact your admin immediately.`,
  },
  email_changed: {
    subject: 'Your email address has been changed — {{platformName}}',
    html: `<p>Hi {{recipientName}},</p><p>Your email address has been changed. If you did not make this change, contact support immediately.</p>`,
    text: `Hi {{recipientName}},\n\nYour email was changed. Contact support if you didn't do this.`,
  },
  password_changed: {
    subject: 'Your password has been changed — {{platformName}}',
    html: `<p>Hi {{recipientName}},</p><p>Your password was changed. If you did not make this change, reset your password immediately.</p><p><a href="{{actionUrl}}">Reset password</a></p>`,
    text: `Hi {{recipientName}},\n\nYour password was changed. If you didn't, reset it: {{actionUrl}}`,
  },
  new_device_sign_in: {
    subject: 'New sign-in detected — {{platformName}}',
    html: `<p>Hi {{recipientName}},</p><p>A sign-in was detected from a new device:</p><ul><li>Device: {{device}}</li><li>IP: {{ipAddress}}</li></ul><p>If this was you, no action needed. Otherwise, secure your account immediately.</p>`,
    text: `Hi {{recipientName}},\n\nNew sign-in from {{device}} at {{ipAddress}}.`,
  },
  account_deletion: {
    subject: 'Account deletion request — {{platformName}}',
    html: `<p>Hi {{recipientName}},</p><p>Your account deletion request has been received. Your account will be permanently deleted after a grace period.</p>`,
    text: `Hi {{recipientName}},\n\nYour account deletion request was received.`,
  },
};
