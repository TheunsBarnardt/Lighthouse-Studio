import type {
  Artifact,
  AiUsageRecord,
  ArtifactFilter,
  ArtifactPage,
  ArtifactRepositoryError,
  ArtifactRepositoryPort,
  BudgetStatus,
  CreateArtifactInput,
  PaginatedArtifacts,
  QualitySignal,
  QualitySignals,
  UpdateArtifactInput,
  UsageQueryOptions,
  UsageSummary,
} from '@platform/ports-ai-artifacts';
import type { Result } from 'neverthrow';
import type { Pool } from 'pg';

import { err, ok } from 'neverthrow';
import { uuidv7 } from 'uuidv7';

// ── Row types ─────────────────────────────────────────────────────────────────

interface ArtifactRow {
  id: string;
  workspace_id: string;
  stage: string;
  type: string;
  parent_artifact_ids: string;
  child_artifact_ids: string;
  status: string;
  current_version: number;
  content: string;
  reasoning: string;
  quality_signals: string;
  generated_by: string | null;
  approval_id: string | null;
  created_by_user_id: string | null;
  approved_at: Date | null;
  approved_by_user_id: string | null;
  _version: number;
  _archived_at: Date | null;
  _created_at: Date;
  _updated_at: Date;
}

function rowToArtifact(row: ArtifactRow): Artifact {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    stage: row.stage as Artifact['stage'],
    type: row.type,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    parentArtifactIds:
      typeof row.parent_artifact_ids === 'string'
        ? JSON.parse(row.parent_artifact_ids)
        : row.parent_artifact_ids,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    childArtifactIds:
      typeof row.child_artifact_ids === 'string'
        ? JSON.parse(row.child_artifact_ids)
        : row.child_artifact_ids,
    status: row.status as Artifact['status'],
    currentVersion: row.current_version,
    content: typeof row.content === 'string' ? JSON.parse(row.content) : row.content,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    reasoning: typeof row.reasoning === 'string' ? JSON.parse(row.reasoning) : row.reasoning,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    qualitySignals:
      typeof row.quality_signals === 'string'
        ? JSON.parse(row.quality_signals)
        : row.quality_signals,
    ...(row.generated_by !== null && {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      generatedBy:
        typeof row.generated_by === 'string' ? JSON.parse(row.generated_by) : row.generated_by,
    }),
    ...(row.approval_id !== null && { approvalId: row.approval_id }),
    createdByUserId: row.created_by_user_id,
    ...(row.approved_at !== null && { approvedAt: row.approved_at }),
    ...(row.approved_by_user_id !== null && { approvedByUserId: row.approved_by_user_id }),
    createdAt: row._created_at,
    updatedAt: row._updated_at,
  };
}

function mapError(cause: unknown): ArtifactRepositoryError {
  const code = (cause as { code?: string }).code;
  if (code === '23505') return { code: 'conflict', message: 'Unique constraint violation' };
  return { code: 'persistence_error', message: String(cause) };
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class PostgresAiArtifactRepository implements ArtifactRepositoryPort {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateArtifactInput): Promise<Result<Artifact, ArtifactRepositoryError>> {
    try {
      const id = uuidv7();
      const now = new Date();
      const { rows } = await this.pool.query<ArtifactRow>(
        `INSERT INTO ai_artifacts
           (id, workspace_id, stage, type, parent_artifact_ids, child_artifact_ids,
            status, current_version, content, reasoning, quality_signals, generated_by,
            created_by_user_id, _version, _created_at, _updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'draft',1,$7,$8,$9,$10,$11,1,$12,$12)
         RETURNING *`,
        [
          id,
          input.workspaceId,
          input.stage,
          input.type,
          JSON.stringify(input.parentArtifactIds ?? []),
          JSON.stringify([]),
          JSON.stringify(input.content),
          JSON.stringify(input.reasoning),
          JSON.stringify({
            submissionCount: 0,
            rejectionCount: 0,
            approvedFirstSubmit: false,
            revisionCount: 0,
            editsAfterGeneration: 0,
            totalEditCharCount: 0,
          } as QualitySignals),
          input.generatedBy ? JSON.stringify(input.generatedBy) : null,
          input.createdByUserId,
          now,
        ],
      );
      if (!rows[0])
        return err({ code: 'persistence_error', message: 'Insert did not return a row' });
      return ok(rowToArtifact(rows[0]));
    } catch (e) {
      return err(mapError(e));
    }
  }

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<Artifact | null, ArtifactRepositoryError>> {
    try {
      const { rows } = await this.pool.query<ArtifactRow>(
        `SELECT * FROM ai_artifacts WHERE id = $1 AND workspace_id = $2 AND _archived_at IS NULL`,
        [id, workspaceId],
      );
      return ok(rows[0] ? rowToArtifact(rows[0]) : null);
    } catch (e) {
      return err(mapError(e));
    }
  }

  async findMany(
    filter: ArtifactFilter,
    page?: ArtifactPage,
  ): Promise<Result<PaginatedArtifacts, ArtifactRepositoryError>> {
    try {
      const conditions: string[] = ['workspace_id = $1', '_archived_at IS NULL'];
      const params: unknown[] = [filter.workspaceId];

      if (filter.stage) {
        params.push(filter.stage);
        conditions.push(`stage = $${String(params.length)}`);
      }
      if (filter.type) {
        params.push(filter.type);
        conditions.push(`type = $${String(params.length)}`);
      }
      if (filter.status) {
        if (Array.isArray(filter.status)) {
          params.push(filter.status);
          conditions.push(`status = ANY($${String(params.length)})`);
        } else {
          params.push(filter.status);
          conditions.push(`status = $${String(params.length)}`);
        }
      }
      if (filter.parentArtifactId) {
        params.push(`["${filter.parentArtifactId}"%`);
        conditions.push(`parent_artifact_ids::text LIKE $${String(params.length)}`);
      }

      const where = conditions.join(' AND ');
      const limit = page?.limit ?? 20;
      const offset = page?.offset ?? 0;

      const [{ rows }, { rows: countRows }] = await Promise.all([
        this.pool.query<ArtifactRow>(
          `SELECT * FROM ai_artifacts WHERE ${where} ORDER BY _updated_at DESC LIMIT $${String(params.length + 1)} OFFSET $${String(params.length + 2)}`,
          [...params, limit, offset],
        ),
        this.pool.query<{ count: string }>(
          `SELECT COUNT(*) as count FROM ai_artifacts WHERE ${where}`,
          params,
        ),
      ]);

      return ok({
        items: rows.map(rowToArtifact),
        total: parseInt(countRows[0]?.count ?? '0', 10),
        limit,
        offset,
      });
    } catch (e) {
      return err(mapError(e));
    }
  }

  async findByParent(
    parentArtifactId: string,
    workspaceId: string,
  ): Promise<Result<Artifact[], ArtifactRepositoryError>> {
    try {
      const { rows } = await this.pool.query<ArtifactRow>(
        `SELECT * FROM ai_artifacts
         WHERE workspace_id = $1
           AND _archived_at IS NULL
           AND parent_artifact_ids @> $2::jsonb`,
        [workspaceId, JSON.stringify([parentArtifactId])],
      );
      return ok(rows.map(rowToArtifact));
    } catch (e) {
      return err(mapError(e));
    }
  }

  async update(input: UpdateArtifactInput): Promise<Result<Artifact, ArtifactRepositoryError>> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Lock row and check version
      const { rows: lockRows } = await client.query<{ _version: number }>(
        `SELECT _version FROM ai_artifacts WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
        [input.id, input.workspaceId],
      );
      if (!lockRows[0]) {
        await client.query('ROLLBACK');
        return err({ code: 'not_found', message: `Artifact ${input.id} not found` });
      }
      if (lockRows[0]._version !== input.expectedVersion) {
        await client.query('ROLLBACK');
        return err({ code: 'conflict', message: 'Version mismatch — concurrent edit detected' });
      }

      const sets: string[] = [
        '_version = _version + 1',
        'current_version = current_version + 1',
        '_updated_at = NOW()',
      ];
      const params: unknown[] = [input.id, input.workspaceId];

      if (input.content !== undefined) {
        params.push(JSON.stringify(input.content));
        sets.push(`content = $${String(params.length)}`);
      }
      if (input.status !== undefined) {
        params.push(input.status);
        sets.push(`status = $${String(params.length)}`);
      }
      if (input.approvalId !== undefined) {
        params.push(input.approvalId);
        sets.push(`approval_id = $${String(params.length)}`);
      }
      if (input.approvedAt !== undefined) {
        params.push(input.approvedAt);
        sets.push(`approved_at = $${String(params.length)}`);
      }
      if (input.approvedByUserId !== undefined) {
        params.push(input.approvedByUserId);
        sets.push(`approved_by_user_id = $${String(params.length)}`);
      }

      const { rows } = await client.query<ArtifactRow>(
        `UPDATE ai_artifacts SET ${sets.join(', ')} WHERE id = $1 AND workspace_id = $2 RETURNING *`,
        params,
      );

      await client.query('COMMIT');
      if (!rows[0])
        return err({ code: 'persistence_error', message: 'Update did not return a row' });
      return ok(rowToArtifact(rows[0]));
    } catch (e) {
      await client.query('ROLLBACK');
      return err(mapError(e));
    } finally {
      client.release();
    }
  }

  async archive(id: string, workspaceId: string): Promise<Result<void, ArtifactRepositoryError>> {
    try {
      await this.pool.query(
        `UPDATE ai_artifacts SET _archived_at = NOW() WHERE id = $1 AND workspace_id = $2 AND _archived_at IS NULL`,
        [id, workspaceId],
      );
      return ok(undefined);
    } catch (e) {
      return err(mapError(e));
    }
  }

  async recordQualitySignal(
    id: string,
    workspaceId: string,
    signal: QualitySignal,
  ): Promise<Result<void, ArtifactRepositoryError>> {
    try {
      const { rows } = await this.pool.query<{ quality_signals: string }>(
        `SELECT quality_signals FROM ai_artifacts WHERE id = $1 AND workspace_id = $2`,
        [id, workspaceId],
      );
      if (!rows[0]) return err({ code: 'not_found', message: `Artifact ${id} not found` });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const signals: QualitySignals =
        typeof rows[0].quality_signals === 'string'
          ? JSON.parse(rows[0].quality_signals)
          : rows[0].quality_signals;

      switch (signal.type) {
        case 'edit':
          signals.editsAfterGeneration++;
          if (signal.metadata?.['charCount']) {
            signals.totalEditCharCount += signal.metadata['charCount'] as number;
          }
          break;
        case 'submission':
          signals.submissionCount++;
          break;
        case 'rejection':
          signals.rejectionCount++;
          if (signal.metadata?.['reason']) {
            signals.rejectionReasons = [
              ...(signals.rejectionReasons ?? []),
              signal.metadata['reason'] as string,
            ];
          }
          break;
        case 'approval':
          signals.approvedFirstSubmit = signals.submissionCount <= 1;
          break;
        case 'revision':
          signals.revisionCount++;
          break;
      }

      await this.pool.query(
        `UPDATE ai_artifacts SET quality_signals = $1, _updated_at = NOW() WHERE id = $2 AND workspace_id = $3`,
        [JSON.stringify(signals), id, workspaceId],
      );
      return ok(undefined);
    } catch (e) {
      return err(mapError(e));
    }
  }

  async recordUsage(record: AiUsageRecord): Promise<Result<void, ArtifactRepositoryError>> {
    try {
      await this.pool.query(
        `INSERT INTO ai_usage_records
           (id, workspace_id, user_id, stage, artifact_id, prompt_id, prompt_version,
            provider, model, input_tokens, output_tokens, tool_use_tokens, cost_usd,
            duration_ms, cached, status, _created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          record.id,
          record.workspaceId,
          record.userId ?? null,
          record.stage,
          record.artifactId ?? null,
          record.promptId,
          record.promptVersion,
          record.provider,
          record.model,
          record.inputTokens,
          record.outputTokens,
          record.toolUseTokens,
          record.costUsd,
          record.durationMs,
          record.cached,
          record.status,
          record.createdAt,
        ],
      );
      return ok(undefined);
    } catch (e) {
      return err(mapError(e));
    }
  }

  async getUsageSummary(
    workspaceId: string,
    opts: UsageQueryOptions,
  ): Promise<Result<UsageSummary, ArtifactRepositoryError>> {
    try {
      const conditions = ['workspace_id = $1'];
      const params: unknown[] = [workspaceId];

      if (opts.startDate) {
        params.push(opts.startDate);
        conditions.push(`_created_at >= $${String(params.length)}`);
      }
      if (opts.endDate) {
        params.push(opts.endDate);
        conditions.push(`_created_at <= $${String(params.length)}`);
      }
      if (opts.stage) {
        params.push(opts.stage);
        conditions.push(`stage = $${String(params.length)}`);
      }

      const where = conditions.join(' AND ');

      const [totals, byStage] = await Promise.all([
        this.pool.query<{
          total_input: string;
          total_output: string;
          total_tool: string;
          total_cost: string;
        }>(
          `SELECT
             SUM(input_tokens) as total_input,
             SUM(output_tokens) as total_output,
             SUM(tool_use_tokens) as total_tool,
             SUM(cost_usd) as total_cost
           FROM ai_usage_records WHERE ${where}`,
          params,
        ),
        this.pool.query<{
          stage: string;
          input_tokens: string;
          output_tokens: string;
          cost_usd: string;
        }>(
          `SELECT stage, SUM(input_tokens) as input_tokens, SUM(output_tokens) as output_tokens, SUM(cost_usd) as cost_usd
           FROM ai_usage_records WHERE ${where} GROUP BY stage`,
          params,
        ),
      ]);

      const summary: UsageSummary = {
        workspaceId,
        totalInputTokens: parseInt(totals.rows[0]?.total_input ?? '0', 10),
        totalOutputTokens: parseInt(totals.rows[0]?.total_output ?? '0', 10),
        totalToolUseTokens: parseInt(totals.rows[0]?.total_tool ?? '0', 10),
        totalCostUsd: parseFloat(totals.rows[0]?.total_cost ?? '0'),
        byStage: Object.fromEntries(
          byStage.rows.map((r) => [
            r.stage,
            {
              inputTokens: parseInt(r.input_tokens, 10),
              outputTokens: parseInt(r.output_tokens, 10),
              costUsd: parseFloat(r.cost_usd),
            },
          ]),
        ),
        byDay: [],
      };

      return ok(summary);
    } catch (e) {
      return err(mapError(e));
    }
  }

  async checkBudget(
    workspaceId: string,
    _stage: string,
    _estimatedTokens: number,
  ): Promise<Result<BudgetStatus, ArtifactRepositoryError>> {
    try {
      // Get current month usage
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { rows } = await this.pool.query<{ total_cost: string }>(
        `SELECT SUM(cost_usd) as total_cost FROM ai_usage_records
         WHERE workspace_id = $1 AND _created_at >= $2`,
        [workspaceId, startOfMonth],
      );

      const used = parseFloat(rows[0]?.total_cost ?? '0');
      // Default monthly limit: $100 USD per workspace; configurable via workspace settings
      const monthlyLimit = 100;
      const percent = (used / monthlyLimit) * 100;

      return ok({
        withinBudget: used < monthlyLimit,
        monthlyLimitUsd: monthlyLimit,
        usedThisMonthUsd: used,
        remainingUsd: Math.max(0, monthlyLimit - used),
        percentUsed: Math.min(100, percent),
        warning: percent >= 80,
      });
    } catch (e) {
      return err(mapError(e));
    }
  }

  async getCached(cacheKey: string): Promise<Result<unknown, ArtifactRepositoryError>> {
    try {
      const { rows } = await this.pool.query<{ response_json: unknown }>(
        `UPDATE ai_response_cache
         SET hit_count = hit_count + 1, _updated_at = NOW()
         WHERE cache_key = $1 AND expires_at > NOW()
         RETURNING response_json`,
        [cacheKey],
      );
      if (!rows[0]) return ok(null);
      const val = rows[0].response_json;
      return ok(typeof val === 'string' ? JSON.parse(val) : val);
    } catch (e) {
      return err(mapError(e));
    }
  }

  async setCached(
    cacheKey: string,
    workspaceId: string,
    promptId: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<Result<void, ArtifactRepositoryError>> {
    try {
      const ttl = ttlSeconds ?? 86400; // 24h default
      const expiresAt = new Date(Date.now() + ttl * 1000);
      await this.pool.query(
        `INSERT INTO ai_response_cache (id, cache_key, workspace_id, prompt_id, response_json, expires_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
         ON CONFLICT (cache_key) DO UPDATE
         SET response_json = $4, expires_at = $5, _updated_at = NOW()`,
        [cacheKey, workspaceId, promptId, JSON.stringify(value), expiresAt],
      );
      return ok(undefined);
    } catch (e) {
      return err(mapError(e));
    }
  }
}
