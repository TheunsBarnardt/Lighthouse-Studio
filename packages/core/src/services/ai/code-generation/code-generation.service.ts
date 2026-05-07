import { ok, err, type Result } from 'neverthrow';

import type { RequestContext } from '../../../context.js';
import type { AppError } from '../../../errors.js';
import type { IntegrationCatalog } from './integration-catalog.js';
import type { StaticAnalyzer } from './static-analyzer.js';
import type {
  FunctionInventory,
  ServerFunction,
  ServerCodeProject,
  GenerateInventoryInput,
  GenerateFunctionInput,
  RegenerateFunctionInput,
  RollbackFunctionInput,
  FunctionSpec,
} from './types.js';

import { ValidationError, NotFoundError } from '../../../errors.js';
import {
  GenerateInventoryInputSchema,
  GenerateFunctionInputSchema,
  RegenerateFunctionInputSchema,
  RollbackFunctionInputSchema,
  CODE_GENERATION_AUDIT_EVENTS,
} from './types.js';

interface CodeGenerationServiceDeps {
  authz: {
    authorize(
      ctx: RequestContext,
      action: string,
      resource?: string,
    ): Promise<Result<void, AppError>>;
  };
  artifacts: {
    create<T>(workspaceId: string, type: string, content: T): Promise<{ id: string; content: T }>;
    get<T>(id: string, workspaceId: string): Promise<{ id: string; content: T } | null>;
  };
  generation: {
    run<O>(promptId: string, inputs: Record<string, unknown>): Promise<O>;
  };
  pipeline: {
    routeForApproval(ctx: RequestContext, artifactId: string, stageKey: string): Promise<void>;
  };
  projects: {
    get(id: string, workspaceId: string): Promise<ServerCodeProject | null>;
    create(project: Omit<ServerCodeProject, 'createdAt' | 'updatedAt'>): Promise<ServerCodeProject>;
    update(
      id: string,
      workspaceId: string,
      changes: Partial<ServerCodeProject>,
    ): Promise<ServerCodeProject>;
  };
  functions: {
    get(id: string, workspaceId: string): Promise<ServerFunction | null>;
    getVersions(name: string, projectId: string, workspaceId: string): Promise<ServerFunction[]>;
    upsert(fn: ServerFunction): Promise<ServerFunction>;
  };
  staticAnalyzer: StaticAnalyzer;
  integrationCatalog: IntegrationCatalog;
  audit: {
    write(ctx: RequestContext, event: string, payload: Record<string, unknown>): Promise<void>;
  };
  logger: {
    info(msg: string, meta?: Record<string, unknown>): void;
    warn(msg: string, meta?: Record<string, unknown>): void;
    error(msg: string, meta?: Record<string, unknown>): void;
  };
}

export class CodeGenerationService {
  constructor(private readonly deps: CodeGenerationServiceDeps) {}

  async generateInventory(
    ctx: RequestContext,
    input: GenerateInventoryInput,
  ): Promise<Result<FunctionInventory, AppError>> {
    const parsed = GenerateInventoryInputSchema.safeParse(input);
    if (!parsed.success)
      return err(new ValidationError('Invalid inventory input', { issues: parsed.error.issues }));

    const authz = await this.deps.authz.authorize(
      ctx,
      'ai.code_generation.create',
      `project:${parsed.data.projectId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const inventory = await this.deps.generation.run<FunctionInventory>(
      'code-generation/inventory-extraction',
      {
        prdContent: parsed.data.prdContent,
        schemaContent: parsed.data.schemaContent,
        uiProjectSummary: parsed.data.uiProjectSummary ?? '',
        integrations: this.deps.integrationCatalog
          .list()
          .map((i) => ({ id: i.id, name: i.name, description: i.description })),
      },
    );

    await this.deps.audit.write(ctx, CODE_GENERATION_AUDIT_EVENTS.INVENTORY_GENERATED, {
      projectId: parsed.data.projectId,
      functionCount: inventory.functions.length,
    });

    return ok(inventory);
  }

  async generateAll(
    ctx: RequestContext,
    projectId: string,
    inventory: FunctionInventory,
  ): Promise<Result<ServerCodeProject, AppError>> {
    const authz = await this.deps.authz.authorize(
      ctx,
      'ai.code_generation.create',
      `project:${projectId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const functionIds: string[] = [];

    for (const spec of inventory.functions) {
      const fnResult = await this.generateFunction(ctx, {
        projectId,
        spec,
      } as GenerateFunctionInput);
      if (fnResult.isOk()) {
        functionIds.push(fnResult.value.id);
      } else {
        this.deps.logger.warn('Function generation failed', {
          name: spec.name,
          error: fnResult.error.message,
        });
      }
    }

    const project = await this.deps.projects.create({
      id: `codeproj-${projectId}`,
      workspaceId: ctx.workspaceId,
      prdArtifactId: '',
      schemaArtifactId: '',
      functionIds,
      manifest: {
        workspaceId: ctx.workspaceId,
        projectId,
        functions: [],
        integrationsUsed: [],
        estimatedMonthlyCostUsd: 0,
      },
      buildConfig: {
        nodeVersion: '22',
        entrypoint: 'src/index.ts',
        runtime: 'node',
        bundler: 'esbuild',
      },
      status: 'review',
      qualitySignals: {
        totalFunctions: inventory.functions.length,
        approvedFunctions: 0,
        staticAnalysisPassRate: 0,
        typeCheckPassRate: 0,
        permissionAccuracyRate: 0,
        totalRegenerations: 0,
        generationCostUsd: 0,
      },
    });

    return ok(project);
  }

  async generateFunction(
    ctx: RequestContext,
    input: GenerateFunctionInput,
  ): Promise<Result<ServerFunction, AppError>> {
    const parsed = GenerateFunctionInputSchema.safeParse(input);
    if (!parsed.success)
      return err(new ValidationError('Invalid function input', { issues: parsed.error.issues }));

    const authz = await this.deps.authz.authorize(
      ctx,
      'ai.code_generation.create',
      `project:${parsed.data.projectId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const spec = parsed.data.spec as FunctionSpec;
    const promptId = this._selectPrompt(spec.triggerType);

    const generated = await this.deps.generation.run<{
      source: string;
      reasoning: {
        whyThisFunctionExists: string;
        whyThisImplementation: string;
        designDecisions: string[];
      };
      manifestEntry: Record<string, unknown>;
    }>(promptId, { spec, integrations: this.deps.integrationCatalog.list() });

    const staticReport = this.deps.staticAnalyzer.analyze(generated.source);
    const { accurate, missing } = this.deps.staticAnalyzer.checkPermissionDeclarations(
      generated.source,
      spec.requiredPermissions,
    );

    const fn: ServerFunction = {
      id: `fn-${parsed.data.projectId}-${spec.name}`,
      projectId: parsed.data.projectId,
      version: 1,
      spec,
      files: [
        {
          path: `src/functions/${spec.name}.ts`,
          content: generated.source,
          language: 'typescript',
        },
        {
          path: `src/functions/${spec.name}.manifest.json`,
          content: JSON.stringify(generated.manifestEntry, null, 2),
          language: 'json',
        },
      ],
      manifestEntry: {
        name: spec.name,
        triggerType: spec.triggerType,
        triggerConfig: spec.triggerConfig,
        permissions: spec.requiredPermissions,
        secrets: spec.requiredSecrets,
        integrations: spec.requiredIntegrations,
        rateLimit: { requestsPerMinute: 100 },
        timeoutMs: 30000,
        memoryMb: 256,
        artifactId: `fn-${parsed.data.projectId}-${spec.name}`,
        version: 1,
      },
      validationReport: {
        staticAnalysis: staticReport,
        typeCheckPassed: !generated.source.includes(': any'),
        typeCheckErrors: [],
        permissionDeclarationAccurate: accurate,
        derivedPermissionsAdded: missing,
        passed: staticReport.passed && accurate,
      },
      qualitySignals: {
        functionArtifactId: `fn-${parsed.data.projectId}-${spec.name}`,
        initialStaticAnalysisPass: staticReport.passed,
        finalStaticAnalysisPass: staticReport.passed,
        initialTypeCheckPass: true,
        finalTypeCheckPass: true,
        declaredPermissionsAccurate: accurate,
        derivedPermissionsAdded: missing.length,
        acceptedFirstPass: true,
        totalRegenerations: 0,
        charsEditedAfterApproval: 0,
        invocationsTotal: 0,
        invocationsFailed: 0,
        invocationsTimedOut: 0,
        rolledBack: false,
      },
      reasoning: generated.reasoning,
      status: 'draft',
      createdAt: new Date(),
    };

    const saved = await this.deps.functions.upsert(fn);

    await this.deps.audit.write(ctx, CODE_GENERATION_AUDIT_EVENTS.FUNCTION_GENERATED, {
      projectId: parsed.data.projectId,
      functionName: spec.name,
      staticAnalysisPassed: staticReport.passed,
    });

    return ok(saved);
  }

  async regenerateFunction(
    ctx: RequestContext,
    input: RegenerateFunctionInput,
  ): Promise<Result<ServerFunction, AppError>> {
    const parsed = RegenerateFunctionInputSchema.safeParse(input);
    if (!parsed.success)
      return err(new ValidationError('Invalid regenerate input', { issues: parsed.error.issues }));

    const authz = await this.deps.authz.authorize(
      ctx,
      'ai.code_generation.regenerate',
      `function:${parsed.data.functionId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const existing = await this.deps.functions.get(parsed.data.functionId, ctx.workspaceId);
    if (!existing) return err(new NotFoundError(`Function ${parsed.data.functionId} not found`));

    const promptId = parsed.data.feedback
      ? 'code-generation/regeneration'
      : this._selectPrompt(existing.spec.triggerType);

    const generated = await this.deps.generation.run<{
      source: string;
      reasoning: typeof existing.reasoning;
      manifestEntry: Record<string, unknown>;
    }>(promptId, {
      spec: existing.spec,
      existingSource: existing.files[0]?.content,
      feedback: parsed.data.feedback,
    });

    const staticReport = this.deps.staticAnalyzer.analyze(generated.source);
    const { accurate, missing } = this.deps.staticAnalyzer.checkPermissionDeclarations(
      generated.source,
      existing.spec.requiredPermissions,
    );

    const updated: ServerFunction = {
      ...existing,
      version: existing.version + 1,
      files: [
        {
          path: `src/functions/${existing.spec.name}.ts`,
          content: generated.source,
          language: 'typescript',
        },
        {
          path: `src/functions/${existing.spec.name}.manifest.json`,
          content: JSON.stringify(generated.manifestEntry, null, 2),
          language: 'json',
        },
      ],
      validationReport: {
        staticAnalysis: staticReport,
        typeCheckPassed: !generated.source.includes(': any'),
        typeCheckErrors: [],
        permissionDeclarationAccurate: accurate,
        derivedPermissionsAdded: missing,
        passed: staticReport.passed && accurate,
      },
      qualitySignals: {
        ...existing.qualitySignals,
        finalStaticAnalysisPass: staticReport.passed,
        finalTypeCheckPass: true,
        declaredPermissionsAccurate: accurate,
        derivedPermissionsAdded: missing.length,
        acceptedFirstPass: false,
        totalRegenerations: existing.qualitySignals.totalRegenerations + 1,
      },
      reasoning: generated.reasoning,
      status: 'draft',
    };

    const saved = await this.deps.functions.upsert(updated);

    await this.deps.audit.write(ctx, CODE_GENERATION_AUDIT_EVENTS.FUNCTION_REGENERATED, {
      functionId: parsed.data.functionId,
      version: updated.version,
      hasFeedback: !!parsed.data.feedback,
    });

    return ok(saved);
  }

  async approveFunction(
    ctx: RequestContext,
    functionId: string,
  ): Promise<Result<ServerFunction, AppError>> {
    const authz = await this.deps.authz.authorize(
      ctx,
      'ai.code_generation.approve',
      `function:${functionId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const fn = await this.deps.functions.get(functionId, ctx.workspaceId);
    if (!fn) return err(new NotFoundError(`Function ${functionId} not found`));

    const updated = await this.deps.functions.upsert({
      ...fn,
      status: 'approved',
      approvedAt: new Date(),
      approvedBy: (ctx as { userId?: string }).userId ?? 'unknown',
    });

    await this.deps.audit.write(ctx, CODE_GENERATION_AUDIT_EVENTS.FUNCTION_APPROVED, {
      functionId,
    });

    return ok(updated);
  }

  async rollbackFunction(
    ctx: RequestContext,
    input: RollbackFunctionInput,
  ): Promise<Result<ServerFunction, AppError>> {
    const parsed = RollbackFunctionInputSchema.safeParse(input);
    if (!parsed.success)
      return err(new ValidationError('Invalid rollback input', { issues: parsed.error.issues }));

    const authz = await this.deps.authz.authorize(
      ctx,
      'ai.code_generation.rollback',
      `function:${parsed.data.functionId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const fn = await this.deps.functions.get(parsed.data.functionId, ctx.workspaceId);
    if (!fn) return err(new NotFoundError(`Function ${parsed.data.functionId} not found`));

    const versions = await this.deps.functions.getVersions(
      fn.spec.name,
      fn.projectId,
      ctx.workspaceId,
    );
    const target = versions.find((v) => v.version === parsed.data.targetVersion);
    if (!target)
      return err(
        new NotFoundError(
          `Version ${String(parsed.data.targetVersion)} of function ${fn.spec.name} not found`,
        ),
      );

    const rolledBack = await this.deps.functions.upsert({
      ...target,
      id: fn.id,
      version: fn.version + 1,
      status: 'approved',
      qualitySignals: { ...target.qualitySignals, rolledBack: true },
    });

    await this.deps.audit.write(ctx, CODE_GENERATION_AUDIT_EVENTS.FUNCTION_ROLLED_BACK, {
      functionId: parsed.data.functionId,
      targetVersion: parsed.data.targetVersion,
      newVersion: rolledBack.version,
    });

    return ok(rolledBack);
  }

  async getFunction(
    ctx: RequestContext,
    functionId: string,
  ): Promise<Result<ServerFunction, AppError>> {
    const authz = await this.deps.authz.authorize(
      ctx,
      'ai.code_generation.read',
      `function:${functionId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const fn = await this.deps.functions.get(functionId, ctx.workspaceId);
    if (!fn) return err(new NotFoundError(`Function ${functionId} not found`));
    return ok(fn);
  }

  async approveProject(
    ctx: RequestContext,
    projectId: string,
  ): Promise<Result<ServerCodeProject, AppError>> {
    const authz = await this.deps.authz.authorize(
      ctx,
      'ai.code_generation.approve',
      `project:${projectId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const project = await this.deps.projects.get(projectId, ctx.workspaceId);
    if (!project) return err(new NotFoundError(`Project ${projectId} not found`));

    const updated = await this.deps.projects.update(projectId, ctx.workspaceId, {
      status: 'approved',
    });

    await this.deps.audit.write(ctx, CODE_GENERATION_AUDIT_EVENTS.PROJECT_APPROVED, { projectId });

    return ok(updated);
  }

  async exportProject(
    ctx: RequestContext,
    projectId: string,
  ): Promise<Result<{ downloadUrl: string }, AppError>> {
    const authz = await this.deps.authz.authorize(
      ctx,
      'ai.code_generation.export',
      `project:${projectId}`,
    );
    if (authz.isErr()) return err(authz.error);

    const project = await this.deps.projects.get(projectId, ctx.workspaceId);
    if (!project) return err(new NotFoundError(`Project ${projectId} not found`));

    await this.deps.audit.write(ctx, CODE_GENERATION_AUDIT_EVENTS.EXPORTED, { projectId });

    return ok({ downloadUrl: `/artifacts/${projectId}/server-code.zip` });
  }

  private _selectPrompt(triggerType: string): string {
    const promptMap: Record<string, string> = {
      http: 'code-generation/http-function',
      schedule: 'code-generation/scheduled-function',
      event: 'code-generation/event-function',
      manual: 'code-generation/http-function',
    };
    return promptMap[triggerType] ?? 'code-generation/http-function';
  }
}
