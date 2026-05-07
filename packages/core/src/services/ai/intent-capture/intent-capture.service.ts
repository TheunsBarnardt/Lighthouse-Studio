import type { Artifact } from '@platform/ports-ai-artifacts';
import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';
import type { RepositoryPort } from '@platform/ports-persistence';
import type { Result } from 'neverthrow';

import { err, ok } from 'neverthrow';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';

import type { AppError } from '../../../errors.js';
import type { ArtifactService } from '../artifact.service.js';
import type { GenerationService } from '../generation.service.js';
import type { StagePipelineService } from '../stage-pipeline.service.js';
import type {
  BriefDraft,
  BriefEdit,
  Conversation,
  ConversationEvent,
  IntentBrief,
  IntentBriefTemplate,
} from './types.js';

import { toAuditActor, auditMeta } from '../../../context.js';
import { ForbiddenError, InternalError, NotFoundError, ValidationError } from '../../../errors.js';
import { observable } from '../../../observability/observable.js';
import { INTENT_CAPTURE_AUDIT_EVENTS } from './audit-events.js';
import { INTENT_CAPTURE_PERMISSIONS } from './permissions.js';
import { IntentBriefSchema } from './types.js';
// ── Imports for prompts (side-effect: registers them) ─────────────────────────
import '../../../ai/prompts/intent-capture/index.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_TURNS = 25;
const CONVERSATION_EXPIRY_DAYS = 30;

// ── Input types ───────────────────────────────────────────────────────────────

export interface StartConversationInput {
  templateId?: string;
}

export interface SendMessageInput {
  conversationId: string;
  message: string;
}

export interface ListConversationsOptions {
  limit?: number;
  offset?: number;
  status?: Conversation['status'];
}

export interface ListTemplatesOptions {
  limit?: number;
  offset?: number;
  category?: string;
  includeBuiltIn?: boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class IntentCaptureService {
  readonly startConversation!: (
    ctx: RequestContext,
    input: StartConversationInput,
  ) => Promise<Result<Artifact, AppError>>;

  readonly getBriefDraft!: (
    ctx: RequestContext,
    conversationId: string,
  ) => Promise<Result<BriefDraft, AppError>>;

  readonly generateBrief!: (
    ctx: RequestContext,
    conversationId: string,
  ) => Promise<Result<Artifact<IntentBrief>, AppError>>;

  readonly editBrief!: (
    ctx: RequestContext,
    briefId: string,
    changes: BriefEdit,
  ) => Promise<Result<Artifact<IntentBrief>, AppError>>;

  readonly submitForApproval!: (
    ctx: RequestContext,
    briefId: string,
  ) => Promise<Result<Artifact, AppError>>;

  readonly listConversations!: (
    ctx: RequestContext,
    opts?: ListConversationsOptions,
  ) => Promise<Result<{ items: Artifact[]; total: number }, AppError>>;

  readonly getConversation!: (
    ctx: RequestContext,
    conversationId: string,
  ) => Promise<Result<Artifact, AppError>>;

  readonly getTemplate!: (
    ctx: RequestContext,
    templateId: string,
  ) => Promise<Result<IntentBriefTemplate, AppError>>;

  readonly listTemplates!: (
    ctx: RequestContext,
    opts?: ListTemplatesOptions,
  ) => Promise<Result<{ items: IntentBriefTemplate[]; total: number }, AppError>>;

  constructor(
    private readonly authz: AuthorizationPort,
    private readonly artifacts: ArtifactService,
    private readonly generation: GenerationService,
    private readonly pipeline: StagePipelineService,
    private readonly templateRepo: RepositoryPort<IntentBriefTemplate>,
    private readonly audit: AuditPort,
    private readonly logger: LoggerPort,
  ) {
    const obs = { logger: this.logger };
    const s = 'IntentCaptureService';
    this.startConversation = observable(
      s,
      'startConversation',
      obs,
      this._startConversation.bind(this),
    );
    this.getBriefDraft = observable(s, 'getBriefDraft', obs, this._getBriefDraft.bind(this));
    this.generateBrief = observable(s, 'generateBrief', obs, this._generateBrief.bind(this));
    this.editBrief = observable(s, 'editBrief', obs, this._editBrief.bind(this));
    this.submitForApproval = observable(
      s,
      'submitForApproval',
      obs,
      this._submitForApproval.bind(this),
    );
    this.listConversations = observable(
      s,
      'listConversations',
      obs,
      this._listConversations.bind(this),
    );
    this.getConversation = observable(s, 'getConversation', obs, this._getConversation.bind(this));
    this.getTemplate = observable(s, 'getTemplate', obs, this._getTemplate.bind(this));
    this.listTemplates = observable(s, 'listTemplates', obs, this._listTemplates.bind(this));
  }

  // ── Streaming (not observable-wrapped — it's a generator) ────────────────────

  async *sendMessage(
    ctx: RequestContext,
    conversationId: string,
    message: string,
  ): AsyncIterable<ConversationEvent> {
    if (!ctx.workspaceId) {
      yield { type: 'error', code: 'invalid_request', message: 'Workspace context required' };
      return;
    }

    const authzResult = await this.authz.authorize(
      ctx,
      INTENT_CAPTURE_PERMISSIONS.CREATE,
      conversationId,
    );
    if (authzResult.isErr()) {
      yield { type: 'error', code: 'forbidden', message: 'Not authorized' };
      return;
    }

    // Load conversation
    const convResult = await this.artifacts.get(ctx, conversationId);
    if (convResult.isErr()) {
      yield { type: 'error', code: 'not_found', message: 'Conversation not found' };
      return;
    }
    const conv = convResult.value;
    const content = conv.content as ConversationContent;

    // Check expiry
    if (isExpired(content.lastActiveAt)) {
      yield { type: 'error', code: 'expired', message: 'Conversation has expired' };
      return;
    }

    // Check turn limit
    const turnCount = content.turnCount;
    if (turnCount >= MAX_TURNS) {
      yield { type: 'turn_limit_reached', limit: MAX_TURNS };
      return;
    }

    const newTurnNumber = turnCount + 1;
    const briefDraft = content.briefDraft;

    // Add user message
    const userMessage = {
      id: uuidv7(),
      role: 'user' as const,
      content: message,
      turnNumber: newTurnNumber,
      createdAt: new Date(),
      toolCallsUsed: [],
    };
    const messages = [...content.messages, userMessage];

    // Build conversation history string
    const historyStr = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    // Stream from orchestrator
    let responseContent = '';
    let totalCostUsd = content.totalCostUsd;
    let turnCostUsd = 0;
    let briefUpdates: Record<string, unknown> = {};
    let readyToGenerate = false;

    try {
      for await (const event of this.generation.generateStream({
        ctx,
        promptId: 'intent-capture/orchestrator',
        inputs: {
          conversationHistory: historyStr,
          briefDraftJson: JSON.stringify(briefDraft),
          lastUserMessage: message,
          turnNumber: newTurnNumber,
        },
        stage: 'intent_capture',
        artifactId: conversationId,
      })) {
        if (event.type === 'text_delta') {
          responseContent += event.delta;
          yield { type: 'text_delta', delta: event.delta, turnNumber: newTurnNumber };
        } else if (event.type === 'tool_call_start') {
          yield {
            type: 'tool_call_start',
            toolName: event.toolName,
            description: `Using ${event.toolName}`,
          };
        } else if (event.type === 'tool_call_complete') {
          yield {
            type: 'tool_call_complete',
            toolName: event.toolName,
            result: JSON.stringify(event.result),
          };
        } else if (event.type === 'done') {
          turnCostUsd = estimateCostFromTokens(event.usage.inputTokens, event.usage.outputTokens);
          totalCostUsd += turnCostUsd;
        } else if (event.type === 'error') {
          yield { type: 'error', code: event.code, message: event.message };
          return;
        }
      }

      // Parse structured output from response
      try {
        const jsonMatch =
          responseContent.match(/```json\s*([\s\S]*?)```/) ??
          responseContent.match(/\{[\s\S]*"briefUpdates"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1] ?? jsonMatch[0]) as {
            briefUpdates?: Record<string, unknown>;
            readyToGenerate?: boolean;
            response?: string;
          };
          briefUpdates = parsed.briefUpdates ?? {};
          readyToGenerate = parsed.readyToGenerate ?? false;
          if (parsed.response) responseContent = parsed.response;
        }
      } catch {
        // Plain text response — no structured updates
      }

      // Emit brief update events
      for (const [fieldName, value] of Object.entries(briefUpdates)) {
        const preview =
          typeof value === 'string'
            ? value.substring(0, 80)
            : JSON.stringify(value).substring(0, 80);
        yield { type: 'brief_update', fieldName, status: 'tentative', preview };
      }

      if (readyToGenerate) {
        yield { type: 'ready_to_generate', readyToGenerate: true };
      }

      yield { type: 'cost_update', costUsd: turnCostUsd, totalCostUsd };

      // Build updated brief draft
      const updatedDraft: BriefDraft = {
        ...briefDraft,
        ...briefUpdates,
        readyToGenerate,
      };

      // Build assistant message
      const assistantMessage = {
        id: uuidv7(),
        role: 'assistant' as const,
        content: responseContent,
        turnNumber: newTurnNumber,
        costUsd: turnCostUsd,
        createdAt: new Date(),
        briefUpdates,
        toolCallsUsed: [],
      };

      // Persist updated conversation
      const updatedContent: ConversationContent = {
        ...content,
        messages: [...messages, assistantMessage],
        briefDraft: updatedDraft,
        turnCount: newTurnNumber,
        totalCostUsd,
        lastActiveAt: new Date(),
      };

      await this.artifacts.update(ctx, {
        id: conversationId,
        expectedVersion: conv.currentVersion,
        content: updatedContent,
      });

      await this.audit.write({
        eventType: INTENT_CAPTURE_AUDIT_EVENTS.MESSAGE_SENT,
        workspaceId: ctx.workspaceId,
        actor: toAuditActor(ctx),
        resource: { type: 'intent_conversation', id: conversationId },
        action: 'message_sent',
        outcome: 'success',
        metadata: { ...auditMeta(ctx), turnNumber: newTurnNumber, costUsd: turnCostUsd },
        correlationId: ctx.correlationId,
      });

      yield { type: 'turn_complete', message: assistantMessage, briefDraft: updatedDraft };
    } catch (e) {
      this.logger.error('intent-capture.send_message.failed', { error: e });
      yield {
        type: 'error',
        code: 'internal_error',
        message: e instanceof Error ? e.message : String(e),
      };
    }
  }

  // ── Private methods ───────────────────────────────────────────────────────────

  private async _startConversation(
    ctx: RequestContext,
    input: StartConversationInput,
  ): Promise<Result<Artifact, AppError>> {
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const authzResult = await this.authz.authorize(
      ctx,
      INTENT_CAPTURE_PERMISSIONS.CREATE,
      ctx.workspaceId,
    );
    if (authzResult.isErr())
      return err(new ForbiddenError('Not authorized to start conversations'));

    let starterMessage: string | undefined;
    if (input.templateId) {
      const templateResult = await this.templateRepo.findById(input.templateId);
      if (templateResult.isOk() && templateResult.value) {
        starterMessage = templateResult.value.starterMessage;
      }
    }

    const initialContent: ConversationContent = {
      messages: starterMessage
        ? [
            {
              id: uuidv7(),
              role: 'assistant',
              content: `Let's start! ${starterMessage}`,
              turnNumber: 0,
              createdAt: new Date(),
              toolCallsUsed: [],
            },
          ]
        : [],
      briefDraft: createEmptyBriefDraft(),
      turnCount: 0,
      totalCostUsd: 0,
      lastActiveAt: new Date(),
      ...(input.templateId !== undefined && { templateId: input.templateId }),
    };

    const result = await this.artifacts.create(ctx, {
      stage: 'intent_capture',
      type: 'intent_conversation',
      content: initialContent,
      reasoning: {
        rationale: 'Intent capture conversation started',
        alternativesConsidered: [],
        assumptions: [],
        uncertainties: [],
        sourceArtifactIds: [],
      },
    });
    if (result.isErr()) return err(result.error);

    await this.audit.write({
      eventType: INTENT_CAPTURE_AUDIT_EVENTS.CONVERSATION_STARTED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'intent_conversation', id: result.value.id },
      action: 'conversation_started',
      outcome: 'success',
      metadata: {
        ...auditMeta(ctx),
        ...(input.templateId !== undefined && { templateId: input.templateId }),
      },
      correlationId: ctx.correlationId,
    });

    return ok(result.value);
  }

  private async _getBriefDraft(
    ctx: RequestContext,
    conversationId: string,
  ): Promise<Result<BriefDraft, AppError>> {
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const authzResult = await this.authz.authorize(
      ctx,
      INTENT_CAPTURE_PERMISSIONS.READ,
      conversationId,
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    const conv = await this.artifacts.get(ctx, conversationId);
    if (conv.isErr()) return err(conv.error);

    const content = conv.value.content as ConversationContent;
    return ok(content.briefDraft);
  }

  private async _generateBrief(
    ctx: RequestContext,
    conversationId: string,
  ): Promise<Result<Artifact<IntentBrief>, AppError>> {
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const authzResult = await this.authz.authorize(
      ctx,
      INTENT_CAPTURE_PERMISSIONS.CREATE,
      conversationId,
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    const conv = await this.artifacts.get(ctx, conversationId);
    if (conv.isErr()) return err(conv.error);

    const content = conv.value.content as ConversationContent;
    const messages = content.messages;
    const historyStr = messages
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const genResult = await this.generation.generate({
      ctx,
      promptId: 'intent-capture/finalize-brief',
      inputs: {
        conversationHistory: historyStr,
        briefDraftJson: JSON.stringify(content.briefDraft),
      },
      stage: 'intent_capture',
      artifactId: conversationId,
      cacheControl: 'bypass_cache',
    });

    if (genResult.isErr()) return err(genResult.error);

    const output = genResult.value.structuredOutput as
      | { brief?: unknown; reasoning?: string }
      | undefined;
    if (!output || !output.brief) {
      return err(new ValidationError('Failed to generate brief — no structured output returned'));
    }

    const parsed = IntentBriefSchema.safeParse(output.brief);
    if (!parsed.success) {
      return err(new ValidationError(`Generated brief failed validation: ${parsed.error.message}`));
    }

    const briefResult = await this.artifacts.create(ctx, {
      stage: 'intent_capture',
      type: 'intent_brief',
      parentArtifactIds: [conversationId],
      content: parsed.data,
      reasoning: {
        rationale: output.reasoning ?? 'Brief generated from conversation',
        alternativesConsidered: [],
        assumptions: [],
        uncertainties: [],
        sourceArtifactIds: [conversationId],
      },
    });
    if (briefResult.isErr()) return err(briefResult.error);

    // Update conversation status
    await this.artifacts.update(ctx, {
      id: conversationId,
      expectedVersion: conv.value.currentVersion,
      content: {
        ...content,
        status: 'brief_generated',
        briefArtifactId: briefResult.value.id,
      },
    });

    await this.audit.write({
      eventType: INTENT_CAPTURE_AUDIT_EVENTS.BRIEF_GENERATED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'intent_brief', id: briefResult.value.id },
      action: 'brief_generated',
      outcome: 'success',
      metadata: { ...auditMeta(ctx), conversationId, costUsd: genResult.value.costUsd },
      correlationId: ctx.correlationId,
    });

    return ok(briefResult.value as Artifact<IntentBrief>);
  }

  private async _editBrief(
    ctx: RequestContext,
    briefId: string,
    changes: BriefEdit,
  ): Promise<Result<Artifact<IntentBrief>, AppError>> {
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const authzResult = await this.authz.authorize(ctx, INTENT_CAPTURE_PERMISSIONS.EDIT, briefId);
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized to edit brief'));

    const brief = await this.artifacts.get(ctx, briefId);
    if (brief.isErr()) return err(brief.error);

    const currentContent = brief.value.content as IntentBrief;
    const updatedContent: IntentBrief = { ...currentContent, ...changes };

    const parsed = IntentBriefSchema.safeParse(updatedContent);
    if (!parsed.success) {
      return err(new ValidationError(`Brief edit failed validation: ${parsed.error.message}`));
    }

    const updated = await this.artifacts.update(ctx, {
      id: briefId,
      expectedVersion: brief.value.currentVersion,
      content: parsed.data,
    });
    if (updated.isErr()) return err(updated.error);

    await this.audit.write({
      eventType: INTENT_CAPTURE_AUDIT_EVENTS.BRIEF_EDITED,
      workspaceId: ctx.workspaceId,
      actor: toAuditActor(ctx),
      resource: { type: 'intent_brief', id: briefId },
      action: 'brief_edited',
      outcome: 'success',
      metadata: { ...auditMeta(ctx), editedFields: Object.keys(changes) },
      correlationId: ctx.correlationId,
    });

    return ok(updated.value as Artifact<IntentBrief>);
  }

  private async _submitForApproval(
    ctx: RequestContext,
    briefId: string,
  ): Promise<Result<Artifact, AppError>> {
    const authzResult = await this.authz.authorize(ctx, INTENT_CAPTURE_PERMISSIONS.CREATE, briefId);
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    return this.pipeline.submitForApproval(ctx, briefId);
  }

  private async _listConversations(
    ctx: RequestContext,
    opts?: ListConversationsOptions,
  ): Promise<Result<{ items: Artifact[]; total: number }, AppError>> {
    if (!ctx.workspaceId) return err(new ValidationError('Workspace context required'));

    const authzResult = await this.authz.authorize(
      ctx,
      INTENT_CAPTURE_PERMISSIONS.READ,
      ctx.workspaceId,
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    return this.artifacts.list(ctx, {
      stage: 'intent_capture',
      type: 'intent_conversation',
      limit: opts?.limit ?? 20,
      offset: opts?.offset ?? 0,
    });
  }

  private async _getConversation(
    ctx: RequestContext,
    conversationId: string,
  ): Promise<Result<Artifact, AppError>> {
    const authzResult = await this.authz.authorize(
      ctx,
      INTENT_CAPTURE_PERMISSIONS.READ,
      conversationId,
    );
    if (authzResult.isErr()) return err(new ForbiddenError('Not authorized'));

    return this.artifacts.get(ctx, conversationId);
  }

  private async _getTemplate(
    ctx: RequestContext,
    templateId: string,
  ): Promise<Result<IntentBriefTemplate, AppError>> {
    await this.authz.authorize(ctx, INTENT_CAPTURE_PERMISSIONS.READ, templateId);

    const result = await this.templateRepo.findById(templateId);
    if (result.isErr()) return err(new InternalError(result.error.message));
    if (!result.value) return err(new NotFoundError('intent_brief_template', templateId));
    return ok(result.value);
  }

  private async _listTemplates(
    ctx: RequestContext,
    opts?: ListTemplatesOptions,
  ): Promise<Result<{ items: IntentBriefTemplate[]; total: number }, AppError>> {
    await this.authz.authorize(ctx, INTENT_CAPTURE_PERMISSIONS.READ, ctx.workspaceId ?? '');

    const allResult = await this.templateRepo.findMany({ includeArchived: false });
    const all = allResult.isOk() ? allResult.value.items : [];
    const filtered = all.filter((t: IntentBriefTemplate) => {
      if (opts?.category && t.category !== opts.category) return false;
      if (opts?.includeBuiltIn === false && t.builtIn) return false;
      if (t.workspaceId && t.workspaceId !== ctx.workspaceId) return false;
      return true;
    });

    const offset = opts?.offset ?? 0;
    const limit = opts?.limit ?? 20;
    const items = filtered.slice(offset, offset + limit);
    return ok({ items, total: filtered.length });
  }
}

// ── Content types (internal to the service) ───────────────────────────────────

interface ConversationMessageRecord {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  turnNumber: number;
  costUsd?: number;
  createdAt: Date;
  briefUpdates?: Record<string, unknown>;
  toolCallsUsed: string[];
}

interface ConversationContent {
  messages: ConversationMessageRecord[];
  briefDraft: BriefDraft;
  turnCount: number;
  totalCostUsd: number;
  lastActiveAt: Date;
  templateId?: string;
  status?: string;
  briefArtifactId?: string;
  summary?: string;
  keyDecisions?: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function createEmptyBriefDraft(): BriefDraft {
  return {
    goals: [],
    targetUsers: [],
    successCriteria: [],
    inScope: [],
    outOfScope: [],
    constraints: [],
    assumptions: [],
    risks: [],
    references: [],
    fieldStates: {},
    completenessPercent: 0,
    readyToGenerate: false,
  };
}

function isExpired(lastActiveAt: Date | undefined): boolean {
  if (!lastActiveAt) return false;
  const expiryMs = CONVERSATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(lastActiveAt).getTime() > expiryMs;
}

function estimateCostFromTokens(inputTokens: number, outputTokens: number): number {
  // claude-opus-4-7 pricing
  return (inputTokens * 15 + outputTokens * 75) / 1_000_000;
}

// ── Zod input validation ──────────────────────────────────────────────────────

export const StartConversationInputSchema = z.object({
  templateId: z.string().optional(),
});

export const SendMessageInputSchema = z.object({
  conversationId: z.string().min(1),
  message: z.string().min(1).max(10000),
});

export const BriefEditSchema = z.object({
  title: z.string().optional(),
  summary: z.string().optional(),
  goals: z.array(z.unknown()).optional(),
  targetUsers: z.array(z.unknown()).optional(),
  successCriteria: z.array(z.unknown()).optional(),
  inScope: z.array(z.string()).optional(),
  outOfScope: z.array(z.string()).optional(),
  estimatedScope: z.enum(['small', 'medium', 'large', 'xl']).optional(),
  constraints: z.array(z.unknown()).optional(),
  assumptions: z.array(z.unknown()).optional(),
  risks: z.array(z.unknown()).optional(),
  references: z.array(z.unknown()).optional(),
});
