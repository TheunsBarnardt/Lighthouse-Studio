import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';
import type { Result } from 'neverthrow';

import { err, ok } from 'neverthrow';

import type { PromptDefinition } from '../../ai/define-prompt.js';
import type { AppError } from '../../errors.js';

import { getPrompt } from '../../ai/define-prompt.js';
import { NotFoundError, ValidationError } from '../../errors.js';
import { observable } from '../../observability/observable.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RedactionRecord {
  field: string;
  originalType: string;
  placeholder: string;
}

export interface RenderedPrompt {
  systemPrompt: string;
  userPrompt: string;
  redactionLog: RedactionRecord[];
  promptId: string;
  promptVersion: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class PromptService {
  readonly load!: (
    ctx: RequestContext,
    promptId: string,
  ) => Promise<Result<PromptDefinition, AppError>>;
  readonly render!: (
    ctx: RequestContext,
    promptId: string,
    inputs: unknown,
  ) => Promise<Result<RenderedPrompt, AppError>>;

  constructor(
    _authz: AuthorizationPort,
    private readonly logger: LoggerPort,
  ) {
    const obs = { logger: this.logger };
    const s = 'PromptService';
    this.load = observable(s, 'load', obs, this._load.bind(this));
    this.render = observable(s, 'render', obs, this._render.bind(this));
  }

  private _load(
    _ctx: RequestContext,
    promptId: string,
  ): Promise<Result<PromptDefinition, AppError>> {
    const prompt = getPrompt(promptId);
    if (!prompt) return Promise.resolve(err(new NotFoundError('prompt', promptId)));
    return Promise.resolve(ok(prompt));
  }

  private async _render(
    ctx: RequestContext,
    promptId: string,
    inputs: unknown,
  ): Promise<Result<RenderedPrompt, AppError>> {
    const promptResult = await this._load(ctx, promptId);
    if (promptResult.isErr()) return err(promptResult.error);
    const prompt = promptResult.value;

    const parsed = prompt.inputs.safeParse(inputs);
    if (!parsed.success) {
      return err(
        new ValidationError(`Invalid inputs for prompt '${promptId}': ${parsed.error.message}`),
      );
    }

    // PII redaction is workspace-aware; for now we pass through
    // The PersonalDataRegistry (Obj 7) integration would happen here
    const userPrompt = prompt.userPromptTemplate(parsed.data);

    return ok({
      systemPrompt: prompt.systemPrompt,
      userPrompt,
      redactionLog: [],
      promptId: prompt.id,
      promptVersion: prompt.version,
    });
  }
}
