import { ok, err, type Result } from 'neverthrow';

import type { RequestContext } from '../../../context.js';
import type { AppError } from '../../../errors.js';
import type {
  DeploymentPlan,
  Deployment,
  DeploymentSummary,
  DeploymentEvent,
  GeneratePlanInput,
  UpdatePlanInput,
  DeployToEnvironmentInput,
  RollbackInput,
} from './types.js';

import { ValidationError, NotFoundError } from '../../../errors.js';
import {
  GeneratePlanInputSchema,
  UpdatePlanInputSchema,
  DeployToEnvironmentInputSchema,
  RollbackInputSchema,
  DEPLOYMENT_AUDIT_EVENTS,
} from './types.js';

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface DeploymentServiceDeps {
  authz: {
    authorize(
      ctx: RequestContext,
      action: string,
      resource?: string,
    ): Promise<Result<void, AppError>>;
  };
  plans: {
    get(id: string, workspaceId: string): Promise<DeploymentPlan | null>;
    create(plan: Omit<DeploymentPlan, 'createdAt'>): Promise<DeploymentPlan>;
    update(
      id: string,
      workspaceId: string,
      changes: Partial<DeploymentPlan>,
    ): Promise<DeploymentPlan>;
  };
  deployments: {
    get(id: string, workspaceId: string): Promise<Deployment | null>;
    create(dep: Omit<Deployment, 'startedAt'>): Promise<Deployment>;
    update(id: string, workspaceId: string, changes: Partial<Deployment>): Promise<Deployment>;
    list(
      workspaceId: string,
      opts: { page: number; pageSize: number },
    ): Promise<PaginatedResult<DeploymentSummary>>;
  };
  generation: {
    run<O>(promptId: string, inputs: Record<string, unknown>): Promise<O>;
  };
  executor: DeploymentExecutorPort;
  audit: {
    write(ctx: RequestContext, event: string, payload: Record<string, unknown>): Promise<void>;
  };
  logger: {
    info(msg: string, meta?: Record<string, unknown>): void;
    warn(msg: string, meta?: Record<string, unknown>): void;
  };
}

interface DeploymentExecutorPort {
  execute(deploymentId: string): Promise<void>;
  rollback(deploymentId: string, reason?: string): Promise<void>;
  streamEvents(deploymentId: string): AsyncIterable<DeploymentEvent>;
}

export class DeploymentService {
  constructor(private readonly deps: DeploymentServiceDeps) {}

  async generateDeploymentPlan(
    ctx: RequestContext,
    input: GeneratePlanInput,
  ): Promise<Result<DeploymentPlan, AppError>> {
    const parsed = GeneratePlanInputSchema.safeParse(input);
    if (!parsed.success)
      return err(
        new ValidationError(
          'Invalid plan input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );

    const authz = await this.deps.authz.authorize(
      ctx,
      'ai.deployment.create',
      `project:${parsed.data.projectId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const generated = await this.deps.generation.run<
      Pick<
        DeploymentPlan,
        | 'environments'
        | 'schemaMigrations'
        | 'irreversibleOperations'
        | 'globalConfig'
        | 'reasoning'
      >
    >('deployment/deployment-plan-generation', {
      projectId: parsed.data.projectId,
      uiProjectId: parsed.data.uiProjectId,
      serverCodeProjectId: parsed.data.serverCodeProjectId,
      schemaId: parsed.data.schemaId,
      testSuiteId: parsed.data.testSuiteId,
      appVersion: parsed.data.appVersion,
    });

    const plan = await this.deps.plans.create({
      appVersion: parsed.data.appVersion,
      workspaceId: ctx.workspaceId ?? '',
      projectId: parsed.data.projectId,
      sourceArtifacts: {
        uiProjectId: parsed.data.uiProjectId,
        serverCodeProjectId: parsed.data.serverCodeProjectId,
        schemaId: parsed.data.schemaId,
        testSuiteId: parsed.data.testSuiteId,
      },
      environments: generated.environments,
      schemaMigrations: generated.schemaMigrations,
      irreversibleOperations: generated.irreversibleOperations,
      globalConfig: generated.globalConfig,
      reasoning: generated.reasoning,
      status: 'draft',
    });

    await this.deps.audit.write(ctx, DEPLOYMENT_AUDIT_EVENTS.PLAN_GENERATED, {
      planId: plan.appVersion,
      projectId: parsed.data.projectId,
      environmentCount: plan.environments.length,
      irreversibleCount: plan.irreversibleOperations.length,
    });

    return ok(plan);
  }

  async getDeploymentPlan(
    ctx: RequestContext,
    planId: string,
  ): Promise<Result<DeploymentPlan, AppError>> {
    const authz = await this.deps.authz.authorize(ctx, 'ai.deployment.read', `plan:${planId}`);
    if (authz.isErr()) return err(authz.error);
    const plan = await this.deps.plans.get(planId, ctx.workspaceId ?? '');
    if (!plan) return err(new NotFoundError('deployment_plan', planId));
    return ok(plan);
  }

  async updateDeploymentPlan(
    ctx: RequestContext,
    input: UpdatePlanInput,
  ): Promise<Result<DeploymentPlan, AppError>> {
    const parsed = UpdatePlanInputSchema.safeParse(input);
    if (!parsed.success)
      return err(
        new ValidationError(
          'Invalid plan update',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );

    const authz = await this.deps.authz.authorize(
      ctx,
      'ai.deployment.create',
      `plan:${parsed.data.planId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const plan = await this.deps.plans.get(parsed.data.planId, ctx.workspaceId ?? '');
    if (!plan) return err(new NotFoundError('deployment_plan', parsed.data.planId));

    const updated = await this.deps.plans.update(
      parsed.data.planId,
      ctx.workspaceId ?? '',
      parsed.data.changes as Partial<DeploymentPlan>,
    );

    await this.deps.audit.write(ctx, DEPLOYMENT_AUDIT_EVENTS.PLAN_EDITED, {
      planId: parsed.data.planId,
    });
    return ok(updated);
  }

  async approvePlan(
    ctx: RequestContext,
    planId: string,
  ): Promise<Result<DeploymentPlan, AppError>> {
    const authz = await this.deps.authz.authorize(ctx, 'ai.deployment.approve', `plan:${planId}`);
    if (authz.isErr()) return err(authz.error);

    const plan = await this.deps.plans.get(planId, ctx.workspaceId ?? '');
    if (!plan) return err(new NotFoundError('deployment_plan', planId));

    const updated = await this.deps.plans.update(planId, ctx.workspaceId ?? '', {
      status: 'approved',
    });
    await this.deps.audit.write(ctx, DEPLOYMENT_AUDIT_EVENTS.PLAN_APPROVED, { planId });
    return ok(updated);
  }

  async deployToEnvironment(
    ctx: RequestContext,
    input: DeployToEnvironmentInput,
  ): Promise<Result<Deployment, AppError>> {
    const parsed = DeployToEnvironmentInputSchema.safeParse(input);
    if (!parsed.success)
      return err(
        new ValidationError(
          'Invalid deploy input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );

    const envPermission = this._envPermission(parsed.data.environmentName);
    const authz = await this.deps.authz.authorize(ctx, envPermission, `plan:${parsed.data.planId}`);
    if (authz.isErr()) return err(authz.error);

    const plan = await this.deps.plans.get(parsed.data.planId, ctx.workspaceId ?? '');
    if (!plan) return err(new NotFoundError('deployment_plan', parsed.data.planId));
    if (plan.status !== 'approved')
      return err(new ValidationError('Plan must be approved before deploying'));

    const envConfig = plan.environments.find((e) => e.name === parsed.data.environmentName);
    if (!envConfig)
      return err(new NotFoundError('deployment_environment', parsed.data.environmentName));

    const deployment = await this.deps.deployments.create({
      id: `dep-${String(Date.now())}`,
      planId: parsed.data.planId,
      workspaceId: ctx.workspaceId ?? '',
      environment: parsed.data.environmentName,
      status: 'pending',
      appVersion: plan.appVersion,
      sourceUiProjectId: plan.sourceArtifacts.uiProjectId,
      sourceServerCodeProjectId: plan.sourceArtifacts.serverCodeProjectId,
      sourceSchemaId: plan.sourceArtifacts.schemaId,
      sourceTestSuiteId: plan.sourceArtifacts.testSuiteId,
      startedByUserId: ctx.userId,
      steps: [
        { stepType: 'pre_flight', status: 'pending' },
        ...(envConfig.testsRequired
          ? [{ stepType: 'tests' as const, status: 'pending' as const }]
          : []),
        { stepType: 'schema', status: 'pending' },
        { stepType: 'server', status: 'pending' },
        { stepType: 'ui', status: 'pending' },
        { stepType: 'health_check', status: 'pending' },
        { stepType: 'cleanup', status: 'pending' },
      ],
    });

    await this.deps.audit.write(ctx, DEPLOYMENT_AUDIT_EVENTS.DEPLOYMENT_INITIATED, {
      deploymentId: deployment.id,
      planId: parsed.data.planId,
      environment: parsed.data.environmentName,
    });

    this.deps.executor.execute(deployment.id).catch((e: unknown) => {
      this.deps.logger.warn('Deployment execution failed', {
        deploymentId: deployment.id,
        error: String(e),
      });
    });

    return ok(deployment);
  }

  async getDeployment(
    ctx: RequestContext,
    deploymentId: string,
  ): Promise<Result<Deployment, AppError>> {
    const authz = await this.deps.authz.authorize(
      ctx,
      'ai.deployment.read',
      `deployment:${deploymentId}`,
    );
    if (authz.isErr()) return err(authz.error);
    const dep = await this.deps.deployments.get(deploymentId, ctx.workspaceId ?? '');
    if (!dep) return err(new NotFoundError('deployment', deploymentId));
    return ok(dep);
  }

  streamDeploymentProgress(
    _ctx: RequestContext,
    deploymentId: string,
  ): AsyncIterable<DeploymentEvent> {
    return this.deps.executor.streamEvents(deploymentId);
  }

  async approvePromotion(
    ctx: RequestContext,
    deploymentId: string,
    targetEnvironment: string,
  ): Promise<Result<Deployment, AppError>> {
    const authz = await this.deps.authz.authorize(
      ctx,
      'ai.deployment.approve',
      `deployment:${deploymentId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const dep = await this.deps.deployments.get(deploymentId, ctx.workspaceId ?? '');
    if (!dep) return err(new NotFoundError('deployment', deploymentId));
    if (dep.status !== 'deployed')
      return err(new ValidationError('Can only promote completed deployments'));

    await this.deps.audit.write(ctx, DEPLOYMENT_AUDIT_EVENTS.ENVIRONMENT_PROMOTED, {
      fromDeploymentId: deploymentId,
      fromEnvironment: dep.environment,
      targetEnvironment,
    });

    return this.deployToEnvironment(ctx, {
      planId: dep.planId,
      environmentName: targetEnvironment,
    });
  }

  async rollback(ctx: RequestContext, input: RollbackInput): Promise<Result<Deployment, AppError>> {
    const parsed = RollbackInputSchema.safeParse(input);
    if (!parsed.success)
      return err(
        new ValidationError(
          'Invalid rollback input',
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );

    const authz = await this.deps.authz.authorize(
      ctx,
      'ai.deployment.rollback',
      `deployment:${parsed.data.deploymentId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const dep = await this.deps.deployments.get(parsed.data.deploymentId, ctx.workspaceId ?? '');
    if (!dep) return err(new NotFoundError('deployment', parsed.data.deploymentId));

    await this.deps.audit.write(ctx, DEPLOYMENT_AUDIT_EVENTS.ROLLBACK_INITIATED, {
      deploymentId: parsed.data.deploymentId,
      reason: parsed.data.reason,
    });

    this.deps.executor
      .rollback(parsed.data.deploymentId, parsed.data.reason)
      .catch((e: unknown) => {
        this.deps.logger.warn('Rollback failed', {
          deploymentId: parsed.data.deploymentId,
          error: String(e),
        });
      });

    const updated = await this.deps.deployments.get(
      parsed.data.deploymentId,
      ctx.workspaceId ?? '',
    );
    if (!updated) return err(new NotFoundError('deployment', parsed.data.deploymentId));
    return ok(updated);
  }

  async cancelDeployment(
    ctx: RequestContext,
    deploymentId: string,
  ): Promise<Result<Deployment, AppError>> {
    const authz = await this.deps.authz.authorize(
      ctx,
      'ai.deployment.cancel',
      `deployment:${deploymentId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const dep = await this.deps.deployments.get(deploymentId, ctx.workspaceId ?? '');
    if (!dep) return err(new NotFoundError('deployment', deploymentId));
    if (!['pending', 'running'].includes(dep.status)) {
      return err(new ValidationError(`Cannot cancel deployment in status ${dep.status}`));
    }

    const updated = await this.deps.deployments.update(deploymentId, ctx.workspaceId ?? '', {
      status: 'cancelled',
      completedAt: new Date(),
    });

    await this.deps.audit.write(ctx, DEPLOYMENT_AUDIT_EVENTS.DEPLOYMENT_CANCELLED, {
      deploymentId,
    });
    return ok(updated);
  }

  async listDeployments(
    ctx: RequestContext,
    opts: { page?: number; pageSize?: number } = {},
  ): Promise<Result<PaginatedResult<DeploymentSummary>, AppError>> {
    const authz = await this.deps.authz.authorize(
      ctx,
      'ai.deployment.read',
      `workspace:${ctx.workspaceId ?? ''}`,
    );
    if (authz.isErr()) return err(authz.error);

    const result = await this.deps.deployments.list(ctx.workspaceId ?? '', {
      page: opts.page ?? 1,
      pageSize: opts.pageSize ?? 20,
    });
    return ok(result);
  }

  private _envPermission(envName: string): string {
    if (envName === 'dev') return 'ai.deployment.deploy_dev';
    if (envName === 'staging') return 'ai.deployment.deploy_staging';
    return 'ai.deployment.deploy_prod';
  }
}
