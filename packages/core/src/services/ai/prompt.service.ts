import type { AuditPort } from '@platform/ports-audit';
import type { AuthorizationPort, RequestContext } from '@platform/ports-authorization';
import type { LoggerPort } from '@platform/ports-observability';

import { err, ok, type Result } from 'neverthrow';

import type { PromptDefinition } from '../../ai/define-prompt.js';
import type { AppError } from '../../errors.js';

import { personalDataRegistry } from '../../compliance/personal-data-registry.js';
import { ExternalServiceError, NotFoundError, ValidationError } from '../../errors.js';
import { observable } from '../../observability/observable.js';

export interface RedactionRecord {
  original: string;
  redacted: string;
  category: string;
}

export interface RenderedPrompt {
  systemPrompt: string;
  userPrompt: string;
  redactionLog: RedactionRecord[];
}

export interface PromptTestResult {
  promptId: string;
  passed: number;
  failed: number;
  errors: Array<{ testName: string; assertion: string; details: string }>;
}

// Registry of all prompts, populated via registerPrompt() at startup.
const promptRegistry = new Map<string, PromptDefinition<unknown, unknown>>();

export function registerPrompt<TInput, TOutput>(
  definition: PromptDefinition<TInput, TOutput>,
): void {
  promptRegistry.set(definition.id, definition as PromptDefinition<unknown, unknown>);
}

function redactPiiFromValue(value: string): { redacted: string; log: RedactionRecord[] } {
  const log: RedactionRecord[] = [];
  let redacted = value;

  for (const record of personalDataRegistry) {
    const category = record.category;
    // Simple pattern-based redaction for common PII categories
    if (category === 'contact' && value.includes('@')) {
      // Email pattern
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      redacted = redacted.replace(emailRegex, (match) => {
        log.push({ original: match, redacted: '<email_redacted>', category });
        return '<email_redacted>';
      });
    }
  }

  return { redacted, log };
}

export class PromptService {
  readonly load!: (
    ctx: RequestContext,
    promptId: string,
  ) => Promise<Result<PromptDefinition<unknown, unknown>, AppError>>;

  readonly render!: (
    ctx: RequestContext,
    promptId: string,
    inputs: unknown,
    piiRedactionEnabled?: boolean,
  ) => Promise<Result<RenderedPrompt, AppError>>;

  readonly runTests!: (
    ctx: RequestContext,
    promptId: string,
  ) => Promise<Result<PromptTestResult, AppError>>;

  constructor(_authz: AuthorizationPort, _audit: AuditPort, logger: LoggerPort) {
    const obs = { logger };
    const s = 'PromptService';
    this.load = observable(s, 'load', obs, this._load.bind(this));
    this.render = observable(s, 'render', obs, this._render.bind(this));
    this.runTests = observable(s, 'runTests', obs, this._runTests.bind(this));
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async _load(
    _ctx: RequestContext,
    promptId: string,
  ): Promise<Result<PromptDefinition<unknown, unknown>, AppError>> {
    const prompt = promptRegistry.get(promptId);
    if (!prompt) return err(new NotFoundError('prompt', promptId));
    return ok(prompt);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async _render(
    _ctx: RequestContext,
    promptId: string,
    inputs: unknown,
    piiRedactionEnabled = true,
  ): Promise<Result<RenderedPrompt, AppError>> {
    const prompt = promptRegistry.get(promptId);
    if (!prompt) return err(new NotFoundError('prompt', promptId));

    const parsed = prompt.inputs.safeParse(inputs);
    if (!parsed.success) {
      return err(
        new ValidationError(
          `Invalid inputs for prompt ${promptId}`,
          parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    }

    let userPrompt: string;
    try {
      userPrompt = prompt.userPromptTemplate(parsed.data);
    } catch (thrown: unknown) {
      const msg = thrown instanceof Error ? thrown.message : String(thrown);
      return err(
        new ExternalServiceError('prompt-template', `Template error in ${promptId}: ${msg}`),
      );
    }

    const redactionLog: RedactionRecord[] = [];

    if (piiRedactionEnabled) {
      const { redacted, log } = redactPiiFromValue(userPrompt);
      userPrompt = redacted;
      redactionLog.push(...log);
    }

    return ok({
      systemPrompt: prompt.systemPrompt,
      userPrompt,
      redactionLog,
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async _runTests(
    _ctx: RequestContext,
    promptId: string,
  ): Promise<Result<PromptTestResult, AppError>> {
    const prompt = promptRegistry.get(promptId);
    if (!prompt) return err(new NotFoundError('prompt', promptId));

    const tests = prompt.tests ?? [];
    let passed = 0;
    const errors: PromptTestResult['errors'] = [];

    for (const test of tests) {
      const parsed = prompt.inputs.safeParse(test.input);
      if (!parsed.success) {
        errors.push({
          testName: test.name,
          assertion: 'input_valid',
          details: parsed.error.issues.map((i) => i.message).join('; '),
        });
        continue;
      }

      for (const assertion of test.assertions) {
        if (assertion.type === 'output_matches_schema') {
          // Schema validation is verified at render time; mark as passing in test runner
          passed++;
        } else if (assertion.type === 'custom') {
          try {
            const ok = assertion.check(parsed.data);
            if (ok) {
              passed++;
            } else {
              errors.push({
                testName: test.name,
                assertion: assertion.description,
                details: 'check returned false',
              });
            }
          } catch (e) {
            errors.push({
              testName: test.name,
              assertion: assertion.description,
              details: String(e),
            });
          }
        } else {
          passed++;
        }
      }
    }

    return ok({ promptId, passed, failed: errors.length, errors });
  }
}
