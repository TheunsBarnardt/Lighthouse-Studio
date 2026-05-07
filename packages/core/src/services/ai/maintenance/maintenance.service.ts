import { ok, err, type Result } from 'neverthrow';
import type { RequestContext } from '../../../context.js';
import { ValidationError, NotFoundError } from '../../../errors.js';
import { observable } from '../../../observability/index.js';
import type {
  Signal,
  ChangeRequest,
  DependencyAdvisory,
  AffectedDownstreamReport,
  OutcomeReport,
  IngestSignalInput,
  CreateChangeRequestInput,
  ResolveChangeRequestInput,
  SignalClassification,
} from './types.js';
import {
  IngestSignalInputSchema,
  CreateChangeRequestInputSchema,
  ResolveChangeRequestInputSchema,
  MAINTENANCE_AUDIT_EVENTS,
} from './types.js';
import type { AppError } from '../../../errors.js';

interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

interface MaintenanceServiceDeps {
  authz: { authorize(ctx: RequestContext, action: string, resource?: string): Promise<Result<void, AppError>> };
  signals: {
    get(id: string, workspaceId: string): Promise<Signal | null>;
    create(signal: Omit<Signal, 'ingestedAt'>): Promise<Signal>;
    update(id: string, workspaceId: string, changes: Partial<Signal>): Promise<Signal>;
    list(workspaceId: string, opts: { page: number; pageSize: number }): Promise<PaginatedResult<Signal>>;
  };
  changeRequests: {
    get(id: string, workspaceId: string): Promise<ChangeRequest | null>;
    create(req: Omit<ChangeRequest, 'createdAt' | 'updatedAt'>): Promise<ChangeRequest>;
    update(id: string, workspaceId: string, changes: Partial<ChangeRequest>): Promise<ChangeRequest>;
    list(workspaceId: string, opts: { page: number; pageSize: number }): Promise<PaginatedResult<ChangeRequest>>;
  };
  advisories: {
    list(workspaceId: string): Promise<DependencyAdvisory[]>;
  };
  generation: {
    run<O>(promptId: string, inputs: Record<string, unknown>): Promise<O>;
  };
  audit: { write(ctx: RequestContext, event: string, payload: Record<string, unknown>): Promise<void> };
  logger: { info(msg: string, meta?: Record<string, unknown>): void; warn(msg: string, meta?: Record<string, unknown>): void };
}

export class MaintenanceService {
  constructor(private readonly deps: MaintenanceServiceDeps) {}

  @observable()
  async ingestSignal(ctx: RequestContext, input: IngestSignalInput): Promise<Result<Signal, AppError>> {
    const parsed = IngestSignalInputSchema.safeParse(input);
    if (!parsed.success) return err(new ValidationError('Invalid signal input', { issues: parsed.error.issues }));

    const authz = await this.deps.authz.authorize(ctx, 'ai.maintenance.create_request', `workspace:${parsed.data.workspaceId}`);
    if (authz.isErr()) return err(authz.error);

    const signal = await this.deps.signals.create({
      id: `sig-${Date.now()}`,
      workspaceId: parsed.data.workspaceId,
      source: parsed.data.source,
      severity: parsed.data.severity,
      status: 'new',
      observedAt: parsed.data.observedAt ?? new Date(),
      errorDetails: parsed.data.source === 'error' ? parsed.data.sourceData as Signal['errorDetails'] : undefined,
      perfDetails: parsed.data.source === 'perf' ? parsed.data.sourceData as Signal['perfDetails'] : undefined,
      userReportDetails: parsed.data.source === 'user_report' ? parsed.data.sourceData as Signal['userReportDetails'] : undefined,
      advisoryDetails: parsed.data.source === 'dependency_advisory' ? parsed.data.sourceData as Signal['advisoryDetails'] : undefined,
    });

    await this.deps.audit.write(ctx, MAINTENANCE_AUDIT_EVENTS.SIGNAL_INGESTED, {
      signalId: signal.id,
      source: signal.source,
      severity: signal.severity,
    });

    // Async classification
    this._classifySignalAsync(ctx, signal).catch(e => {
      this.deps.logger.warn('Auto-classification failed', { signalId: signal.id, error: String(e) });
    });

    return ok(signal);
  }

  @observable()
  async listSignals(ctx: RequestContext, opts: { page?: number; pageSize?: number } = {}): Promise<Result<PaginatedResult<Signal>, AppError>> {
    const authz = await this.deps.authz.authorize(ctx, 'ai.maintenance.read', `workspace:${ctx.workspaceId}`);
    if (authz.isErr()) return err(authz.error);
    const result = await this.deps.signals.list(ctx.workspaceId, { page: opts.page ?? 1, pageSize: opts.pageSize ?? 20 });
    return ok(result);
  }

  @observable()
  async classifySignal(ctx: RequestContext, signalId: string): Promise<Result<SignalClassification, AppError>> {
    const authz = await this.deps.authz.authorize(ctx, 'ai.maintenance.read', `signal:${signalId}`);
    if (authz.isErr()) return err(authz.error);

    const signal = await this.deps.signals.get(signalId, ctx.workspaceId);
    if (!signal) return err(new NotFoundError(`Signal ${signalId} not found`));

    const classification = await this.deps.generation.run<SignalClassification>(
      'maintenance/signal-classification',
      { signal, workspaceId: ctx.workspaceId },
    );

    await this.deps.signals.update(signalId, ctx.workspaceId, {
      classification: { ...classification, classifiedAt: new Date(), classifiedBy: 'ai' },
      status: 'classified',
    });

    await this.deps.audit.write(ctx, MAINTENANCE_AUDIT_EVENTS.SIGNAL_CLASSIFIED, {
      signalId,
      suggestedStages: classification.suggestedStages.map(s => s.stageName),
    });

    return ok(classification);
  }

  @observable()
  async createChangeRequest(ctx: RequestContext, input: CreateChangeRequestInput): Promise<Result<ChangeRequest, AppError>> {
    const parsed = CreateChangeRequestInputSchema.safeParse(input);
    if (!parsed.success) return err(new ValidationError('Invalid change request input', { issues: parsed.error.issues }));

    const authz = await this.deps.authz.authorize(ctx, 'ai.maintenance.create_request', `workspace:${parsed.data.workspaceId}`);
    if (authz.isErr()) return err(authz.error);

    const signals = await Promise.all(
      parsed.data.signalIds.map(id => this.deps.signals.get(id, parsed.data.workspaceId))
    );
    const validSignals = signals.filter((s): s is Signal => s !== null);

    const classification = validSignals[0]?.classification ?? {
      suggestedStages: [],
      affectedArtifactIds: [],
      classifiedAt: new Date(),
      classifiedBy: 'ai' as const,
    };

    const maxSeverity = validSignals.reduce<Signal['severity']>((max, s) => {
      const order = ['critical', 'high', 'medium', 'low'] as const;
      return order.indexOf(s.severity) < order.indexOf(max) ? s.severity : max;
    }, 'low');

    const request = await this.deps.changeRequests.create({
      id: `cr-${Date.now()}`,
      workspaceId: parsed.data.workspaceId,
      triggeringSignals: parsed.data.signalIds,
      description: parsed.data.description,
      classification,
      severity: maxSeverity,
      priority: parsed.data.priority ?? this._severityToPriority(maxSeverity),
      affectedArtifactIds: classification.affectedArtifactIds,
      status: 'open',
      rootSignalIds: parsed.data.signalIds,
    });

    await Promise.all(
      parsed.data.signalIds.map(id =>
        this.deps.signals.update(id, parsed.data.workspaceId, { status: 'in_change_request' })
      )
    );

    await this.deps.audit.write(ctx, MAINTENANCE_AUDIT_EVENTS.CHANGE_REQUEST_CREATED, {
      requestId: request.id,
      signalCount: parsed.data.signalIds.length,
      severity: maxSeverity,
    });

    return ok(request);
  }

  @observable()
  async getChangeRequest(ctx: RequestContext, requestId: string): Promise<Result<ChangeRequest, AppError>> {
    const authz = await this.deps.authz.authorize(ctx, 'ai.maintenance.read', `change_request:${requestId}`);
    if (authz.isErr()) return err(authz.error);
    const req = await this.deps.changeRequests.get(requestId, ctx.workspaceId);
    if (!req) return err(new NotFoundError(`Change request ${requestId} not found`));
    return ok(req);
  }

  @observable()
  async listChangeRequests(ctx: RequestContext, opts: { page?: number; pageSize?: number } = {}): Promise<Result<PaginatedResult<ChangeRequest>, AppError>> {
    const authz = await this.deps.authz.authorize(ctx, 'ai.maintenance.read', `workspace:${ctx.workspaceId}`);
    if (authz.isErr()) return err(authz.error);
    const result = await this.deps.changeRequests.list(ctx.workspaceId, { page: opts.page ?? 1, pageSize: opts.pageSize ?? 20 });
    return ok(result);
  }

  @observable()
  async engageStages(ctx: RequestContext, requestId: string): Promise<Result<{ engagedStages: string[] }, AppError>> {
    const authz = await this.deps.authz.authorize(ctx, 'ai.maintenance.engage_stage', `change_request:${requestId}`);
    if (authz.isErr()) return err(authz.error);

    const req = await this.deps.changeRequests.get(requestId, ctx.workspaceId);
    if (!req) return err(new NotFoundError(`Change request ${requestId} not found`));

    const engagedStages = req.classification.suggestedStages.map(s => s.stageName);

    await this.deps.changeRequests.update(requestId, ctx.workspaceId, { status: 'in_progress' });

    await this.deps.audit.write(ctx, MAINTENANCE_AUDIT_EVENTS.CHANGE_REQUEST_ENGAGED_STAGE, {
      requestId,
      engagedStages,
    });

    return ok({ engagedStages });
  }

  @observable()
  async identifyAffectedDownstream(ctx: RequestContext, artifactId: string): Promise<Result<AffectedDownstreamReport, AppError>> {
    const authz = await this.deps.authz.authorize(ctx, 'ai.maintenance.read', `workspace:${ctx.workspaceId}`);
    if (authz.isErr()) return err(authz.error);

    const report = await this.deps.generation.run<AffectedDownstreamReport>(
      'maintenance/affected-downstream-detection',
      { artifactId, workspaceId: ctx.workspaceId },
    );

    return ok(report);
  }

  @observable()
  async resolveChangeRequest(ctx: RequestContext, input: ResolveChangeRequestInput): Promise<Result<ChangeRequest, AppError>> {
    const parsed = ResolveChangeRequestInputSchema.safeParse(input);
    if (!parsed.success) return err(new ValidationError('Invalid resolve input', { issues: parsed.error.issues }));

    const authz = await this.deps.authz.authorize(ctx, 'ai.maintenance.resolve', `change_request:${parsed.data.requestId}`);
    if (authz.isErr()) return err(authz.error);

    const req = await this.deps.changeRequests.get(parsed.data.requestId, ctx.workspaceId);
    if (!req) return err(new NotFoundError(`Change request ${parsed.data.requestId} not found`));

    const newStatus = parsed.data.wontFix ? 'wont_fix' : 'resolved';
    const updated = await this.deps.changeRequests.update(parsed.data.requestId, ctx.workspaceId, {
      status: newStatus,
      resolution: {
        resolvedAt: new Date(),
        resolvedByUserId: ctx.userId ?? 'system',
        notes: parsed.data.notes,
      },
    });

    const event = parsed.data.wontFix ? MAINTENANCE_AUDIT_EVENTS.CHANGE_REQUEST_WONT_FIX : MAINTENANCE_AUDIT_EVENTS.CHANGE_REQUEST_RESOLVED;
    await this.deps.audit.write(ctx, event, { requestId: parsed.data.requestId, notes: parsed.data.notes });

    return ok(updated);
  }

  @observable()
  async listDependencyAdvisories(ctx: RequestContext): Promise<Result<DependencyAdvisory[], AppError>> {
    const authz = await this.deps.authz.authorize(ctx, 'ai.maintenance.read', `workspace:${ctx.workspaceId}`);
    if (authz.isErr()) return err(authz.error);
    const advisories = await this.deps.advisories.list(ctx.workspaceId);
    return ok(advisories);
  }

  @observable()
  async trackOutcome(ctx: RequestContext, requestId: string): Promise<Result<OutcomeReport, AppError>> {
    const authz = await this.deps.authz.authorize(ctx, 'ai.maintenance.read', `change_request:${requestId}`);
    if (authz.isErr()) return err(authz.error);

    const req = await this.deps.changeRequests.get(requestId, ctx.workspaceId);
    if (!req) return err(new NotFoundError(`Change request ${requestId} not found`));

    const report = await this.deps.generation.run<OutcomeReport>(
      'maintenance/outcome-assessment',
      { changeRequest: req, workspaceId: ctx.workspaceId },
    );

    await this.deps.audit.write(ctx, MAINTENANCE_AUDIT_EVENTS.OUTCOME_ASSESSED, {
      requestId,
      resolved: report.resolved,
      confidence: report.confidence,
    });

    return ok(report);
  }

  private async _classifySignalAsync(ctx: RequestContext, signal: Signal) {
    const classification = await this.deps.generation.run<SignalClassification>(
      'maintenance/signal-classification',
      { signal, workspaceId: signal.workspaceId },
    );
    await this.deps.signals.update(signal.id, signal.workspaceId, {
      classification: { ...classification, classifiedAt: new Date(), classifiedBy: 'ai' },
      status: 'classified',
    });
  }

  private _severityToPriority(severity: Signal['severity']): ChangeRequest['priority'] {
    const map: Record<Signal['severity'], ChangeRequest['priority']> = {
      critical: 'p0', high: 'p1', medium: 'p2', low: 'p3',
    };
    return map[severity];
  }
}
