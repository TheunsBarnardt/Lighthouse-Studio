import { ok, err, type Result } from 'neverthrow';

import type { RequestContext } from '../../../context.js';
import type { AppError } from '../../../errors.js';
import type {
  AppChromeConfig,
  ChromeProposal,
  UpdateChromeConfigInput,
  ProposeChromeInput,
  ApplyChromeProposalInput,
} from './types.js';

import { ValidationError, NotFoundError } from '../../../errors.js';
import { STARTER_CHROME_BLOCKS } from './starter-blocks.js';
import {
  UpdateChromeConfigInputSchema,
  ProposeChromInputSchema,
  ApplyChromeProposalInputSchema,
  APP_CHROME_AUDIT_EVENTS,
} from './types.js';

interface AppChromeServiceDeps {
  authz: {
    authorize(
      ctx: RequestContext,
      action: string,
      resource?: string,
    ): Promise<Result<void, AppError>>;
  };
  configs: {
    getByProjectId(projectId: string, workspaceId: string): Promise<AppChromeConfig | null>;
    upsert(config: Omit<AppChromeConfig, 'createdAt' | 'updatedAt'>): Promise<AppChromeConfig>;
    delete(projectId: string, workspaceId: string): Promise<void>;
  };
  generation: {
    run<O>(promptId: string, inputs: Record<string, unknown>): Promise<O>;
  };
  audit: {
    write(ctx: RequestContext, event: string, payload: Record<string, unknown>): Promise<void>;
  };
  logger: {
    info(msg: string, meta?: Record<string, unknown>): void;
    warn(msg: string, meta?: Record<string, unknown>): void;
  };
}

export class AppChromeService {
  constructor(private readonly deps: AppChromeServiceDeps) {}

  async getConfig(
    ctx: RequestContext,
    projectId: string,
  ): Promise<Result<AppChromeConfig | null, AppError>> {
    const authz = await this.deps.authz.authorize(ctx, 'app_chrome.view', `project:${projectId}`);
    if (authz.isErr()) return err(authz.error);

    const config = await this.deps.configs.getByProjectId(projectId, ctx.workspaceId ?? '');
    return ok(config);
  }

  async updateConfig(
    ctx: RequestContext,
    input: UpdateChromeConfigInput,
  ): Promise<Result<AppChromeConfig, AppError>> {
    const parsed = UpdateChromeConfigInputSchema.safeParse(input);
    if (!parsed.success)
      return err(
        new ValidationError(
          'Invalid chrome config input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );

    const authz = await this.deps.authz.authorize(
      ctx,
      'app_chrome.configure',
      `project:${parsed.data.projectId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const existing = await this.deps.configs.getByProjectId(
      parsed.data.projectId,
      ctx.workspaceId ?? '',
    );

    const resolvedHeader = parsed.data.header ?? existing?.header;
    const resolvedSidenav = parsed.data.sidenav ?? existing?.sidenav;
    const resolvedBreadcrumb = parsed.data.breadcrumb ?? existing?.breadcrumb;
    const resolvedFooter = parsed.data.footer ?? existing?.footer;

    const config = await this.deps.configs.upsert({
      id: existing?.id ?? `chrome-${parsed.data.projectId}`,
      projectId: parsed.data.projectId,
      workspaceId: ctx.workspaceId ?? '',
      layout: parsed.data.layout ?? existing?.layout ?? 'sidenav-with-topbar',
      ...(resolvedHeader !== undefined ? { header: resolvedHeader } : {}),
      ...(resolvedSidenav !== undefined ? { sidenav: resolvedSidenav } : {}),
      ...(resolvedBreadcrumb !== undefined ? { breadcrumb: resolvedBreadcrumb } : {}),
      ...(resolvedFooter !== undefined ? { footer: resolvedFooter } : {}),
      pageOverrides: (parsed.data.pageOverrides ??
        existing?.pageOverrides ??
        []) as AppChromeConfig['pageOverrides'],
    });

    await this.deps.audit.write(ctx, APP_CHROME_AUDIT_EVENTS.CONFIG_UPDATED, {
      projectId: parsed.data.projectId,
      changes: Object.keys(parsed.data).filter((k) => k !== 'projectId'),
    });

    return ok(config);
  }

  async resetConfig(ctx: RequestContext, projectId: string): Promise<Result<void, AppError>> {
    const authz = await this.deps.authz.authorize(
      ctx,
      'app_chrome.configure',
      `project:${projectId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const existing = await this.deps.configs.getByProjectId(projectId, ctx.workspaceId ?? '');
    if (!existing) return err(new NotFoundError('app_chrome_config', projectId));

    await this.deps.configs.delete(projectId, ctx.workspaceId ?? '');
    await this.deps.audit.write(ctx, APP_CHROME_AUDIT_EVENTS.CONFIG_RESET, { projectId });

    return ok(undefined);
  }

  async proposeChrome(
    ctx: RequestContext,
    input: ProposeChromeInput,
  ): Promise<Result<ChromeProposal, AppError>> {
    const parsed = ProposeChromInputSchema.safeParse(input);
    if (!parsed.success)
      return err(
        new ValidationError(
          'Invalid propose chrome input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );

    const authz = await this.deps.authz.authorize(
      ctx,
      'app_chrome.propose',
      `project:${parsed.data.projectId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const proposal = await this.deps.generation.run<ChromeProposal>('app-chrome/chrome-proposal', {
      prdContent: parsed.data.prdContent,
      brandPrimary: parsed.data.brandPrimary,
      brandName: parsed.data.brandName,
      availableBlocks: STARTER_CHROME_BLOCKS,
    });

    await this.deps.audit.write(ctx, APP_CHROME_AUDIT_EVENTS.PROPOSAL_GENERATED, {
      projectId: parsed.data.projectId,
      suggestedLayout: proposal.suggestedLayout,
    });

    return ok(proposal);
  }

  async applyProposal(
    ctx: RequestContext,
    input: ApplyChromeProposalInput,
  ): Promise<Result<AppChromeConfig, AppError>> {
    const parsed = ApplyChromeProposalInputSchema.safeParse(input);
    if (!parsed.success)
      return err(
        new ValidationError(
          'Invalid apply proposal input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );

    const authz = await this.deps.authz.authorize(
      ctx,
      'app_chrome.configure',
      `project:${parsed.data.projectId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const { proposal } = parsed.data;

    const updateResult = await this.updateConfig(ctx, {
      projectId: parsed.data.projectId,
      layout: proposal.suggestedLayout,
      header: { blockId: proposal.header.blockId, params: proposal.header.params },
      sidenav: proposal.sidenav
        ? { blockId: proposal.sidenav.blockId, params: proposal.sidenav.params }
        : undefined,
      breadcrumb: proposal.breadcrumb
        ? { blockId: proposal.breadcrumb.blockId, params: proposal.breadcrumb.params }
        : undefined,
      footer: proposal.footer
        ? { blockId: proposal.footer.blockId, params: proposal.footer.params }
        : undefined,
      pageOverrides: proposal.pageOverrides as AppChromeConfig['pageOverrides'],
    });

    if (updateResult.isErr()) return err(updateResult.error);

    await this.deps.audit.write(ctx, APP_CHROME_AUDIT_EVENTS.PROPOSAL_APPLIED, {
      projectId: parsed.data.projectId,
    });

    return ok(updateResult.value);
  }

  listChromeBlocks(_ctx: RequestContext): Result<typeof STARTER_CHROME_BLOCKS, AppError> {
    return ok(STARTER_CHROME_BLOCKS);
  }
}
