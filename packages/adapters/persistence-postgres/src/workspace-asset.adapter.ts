import type { ObjectStoragePort } from '@platform/ports-storage';
import type {
  AssetCategory,
  AssetTopLevel,
  AssetValidationStatus,
  ConsumedAssetSnapshot,
  ContextualAsset,
  ReplaceAssetInput,
  StageAssetContext,
  StalenessCheck,
  StaleAssetEntry,
  UploadAssetInput,
  WorkspaceAsset,
  WorkspaceAssetPort,
  WorkspaceAssetQuota,
} from '@platform/ports-workspace-assets';
import type { Pool } from 'pg';

import {
  AssetNotFoundError,
  AssetQuotaExceededError,
  AssetStorageError,
} from '@platform/ports-workspace-assets';
import { err, ok, type Result } from 'neverthrow';
import { uuidv7 } from 'uuidv7';

// ── WCAG 2.1 contrast math ─────────────────────────────────────────────────────

function sRGBtoLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Returns the higher of the two contrast ratios (against white and black). */
function wcagMaxContrastRatio([r, g, b]: [number, number, number]): number {
  const L = relativeLuminance(r, g, b);
  const vsWhite = contrastRatio(L, 1); // white luminance = 1
  const vsBlack = contrastRatio(L, 0); // black luminance = 0
  return Math.max(vsWhite, vsBlack);
}

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if ([r, g, b].some(isNaN)) return null;
  return [r, g, b];
}

// ── Row type returned by pg ────────────────────────────────────────────────────

interface AssetRow {
  id: string;
  _version: number;
  workspace_id: string;
  top_level: string;
  category: string;
  role: string | null;
  filename: string;
  mime_type: string;
  size_bytes: string; // pg returns bigint as string
  storage_key: string;
  parsed_text_key: string | null;
  validation_status: string;
  validation_reason: string | null;
  uploaded_by: string;
  _created_at: Date;
  _updated_at: Date;
}

function rowToAsset(row: AssetRow): WorkspaceAsset {
  return {
    id: row.id,
    version: row._version,
    workspaceId: row.workspace_id,
    topLevel: row.top_level as AssetTopLevel,
    category: row.category as AssetCategory,
    role: row.role,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    storageKey: row.storage_key,
    parsedTextKey: row.parsed_text_key,
    validationStatus: row.validation_status as AssetValidationStatus,
    validationReason: row.validation_reason,
    uploadedBy: row.uploaded_by,
    createdAt: row._created_at,
    updatedAt: row._updated_at,
  };
}

function storageKey(
  workspaceId: string,
  topLevel: AssetTopLevel,
  category: AssetCategory,
  assetId: string,
  filename: string,
): string {
  return `/workspaces/${workspaceId}/assets/${topLevel}/${category}/${assetId}/${filename}`;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class PostgresWorkspaceAssetAdapter implements WorkspaceAssetPort {
  constructor(
    private readonly pool: Pool,
    private readonly objectStorage: ObjectStoragePort,
  ) {}

  async upload(
    input: UploadAssetInput,
  ): Promise<Result<WorkspaceAsset, AssetQuotaExceededError | AssetStorageError>> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Check quota
      const quotaRow = await client.query<{
        assets_bytes_used: string;
        assets_allowance_bytes: string;
      }>(
        `SELECT assets_bytes_used, assets_allowance_bytes
           FROM workspaces
          WHERE id = $1
            AND _archived_at IS NULL
          FOR UPDATE`,
        [input.workspaceId],
      );

      if (quotaRow.rowCount === 0) {
        await client.query('ROLLBACK');
        return err(new AssetStorageError(`Workspace '${input.workspaceId}' not found`));
      }

      const quotaRowData = quotaRow.rows[0] as Record<string, unknown>;
      const usedBytes = Number(quotaRowData['assets_bytes_used']);
      const allowanceBytes = Number(quotaRowData['assets_allowance_bytes']);
      if (usedBytes + input.sizeBytes > allowanceBytes) {
        await client.query('ROLLBACK');
        return err(
          new AssetQuotaExceededError(
            input.workspaceId,
            usedBytes + input.sizeBytes,
            allowanceBytes,
          ),
        );
      }

      const assetId = uuidv7();
      const key = storageKey(
        input.workspaceId,
        input.topLevel,
        input.category,
        assetId,
        input.filename,
      );

      // Persist blob
      const putResult = await this.objectStorage.put(key, input.data, {
        contentType: input.mimeType,
      });
      if (putResult.isErr()) {
        await client.query('ROLLBACK');
        return err(new AssetStorageError(putResult.error.message));
      }

      // Validate format and parse text for document formats
      const { parsedTextKey, validationStatus, validationReason } = await this._validateAndParse(
        key,
        input.mimeType,
        input.sizeBytes,
        input.topLevel,
        input.category,
      );

      // Insert metadata row
      const now = new Date();
      const insertResult = await client.query<AssetRow>(
        `INSERT INTO workspace_assets
           (id, workspace_id, top_level, category, role, filename, mime_type, size_bytes,
            storage_key, parsed_text_key, validation_status, validation_reason, uploaded_by,
            _created_at, _updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING *`,
        [
          assetId,
          input.workspaceId,
          input.topLevel,
          input.category,
          input.role ?? null,
          input.filename,
          input.mimeType,
          input.sizeBytes,
          key,
          parsedTextKey,
          validationStatus,
          validationReason,
          input.workspaceId, // uploaded_by — callers pass ctx.userId; adapter receives workspaceId here for simplicity; service sets this via input extension if needed
          now,
          now,
        ],
      );

      // Increment quota
      await client.query(
        `UPDATE workspaces
            SET assets_bytes_used = assets_bytes_used + $1,
                _updated_at = NOW()
          WHERE id = $2`,
        [input.sizeBytes, input.workspaceId],
      );

      await client.query('COMMIT');
      return ok(rowToAsset(insertResult.rows[0] as AssetRow));
    } catch (cause) {
      await client.query('ROLLBACK').catch(() => undefined);
      return err(new AssetStorageError(`Upload failed: ${String(cause)}`));
    } finally {
      client.release();
    }
  }

  async replace(
    input: ReplaceAssetInput,
  ): Promise<Result<WorkspaceAsset, AssetNotFoundError | AssetStorageError>> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query<AssetRow>(
        `SELECT * FROM workspace_assets
          WHERE id = $1 AND workspace_id = $2 AND _archived_at IS NULL
          FOR UPDATE`,
        [input.assetId, input.workspaceId],
      );
      if (existing.rowCount === 0) {
        await client.query('ROLLBACK');
        return err(new AssetNotFoundError(input.assetId));
      }
      const prev = existing.rows[0] as AssetRow;
      const sizeDelta = input.sizeBytes - Number(prev.size_bytes);

      const newKey = storageKey(
        input.workspaceId,
        prev.top_level as AssetTopLevel,
        prev.category as AssetCategory,
        input.assetId,
        input.filename,
      );

      // Put new blob
      const putResult = await this.objectStorage.put(newKey, input.data, {
        contentType: input.mimeType,
      });
      if (putResult.isErr()) {
        await client.query('ROLLBACK');
        return err(new AssetStorageError(putResult.error.message));
      }

      // Delete old blob if key changed
      if (prev.storage_key !== newKey) {
        await this.objectStorage.delete(prev.storage_key);
      }

      // Delete old parsed text blob if present
      if (prev.parsed_text_key) {
        await this.objectStorage.delete(prev.parsed_text_key);
      }

      const { parsedTextKey, validationStatus, validationReason } = await this._validateAndParse(
        newKey,
        input.mimeType,
        input.sizeBytes,
        prev.top_level as AssetTopLevel,
        prev.category as AssetCategory,
      );

      const updated = await client.query<AssetRow>(
        `UPDATE workspace_assets
            SET _version          = _version + 1,
                filename          = $1,
                mime_type         = $2,
                size_bytes        = $3,
                storage_key       = $4,
                parsed_text_key   = $5,
                validation_status = $6,
                validation_reason = $7,
                _updated_at       = NOW()
          WHERE id = $8 AND workspace_id = $9
          RETURNING *`,
        [
          input.filename,
          input.mimeType,
          input.sizeBytes,
          newKey,
          parsedTextKey,
          validationStatus,
          validationReason,
          input.assetId,
          input.workspaceId,
        ],
      );

      // Adjust quota counter
      if (sizeDelta !== 0) {
        await client.query(
          `UPDATE workspaces
              SET assets_bytes_used = GREATEST(0, assets_bytes_used + $1),
                  _updated_at = NOW()
            WHERE id = $2`,
          [sizeDelta, input.workspaceId],
        );
      }

      await client.query('COMMIT');
      return ok(rowToAsset(updated.rows[0] as AssetRow));
    } catch (cause) {
      await client.query('ROLLBACK').catch(() => undefined);
      return err(new AssetStorageError(`Replace failed: ${String(cause)}`));
    } finally {
      client.release();
    }
  }

  async delete(
    workspaceId: string,
    assetId: string,
  ): Promise<Result<void, AssetNotFoundError | AssetStorageError>> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query<AssetRow>(
        `SELECT * FROM workspace_assets
          WHERE id = $1 AND workspace_id = $2 AND _archived_at IS NULL
          FOR UPDATE`,
        [assetId, workspaceId],
      );
      if (existing.rowCount === 0) {
        await client.query('ROLLBACK');
        return err(new AssetNotFoundError(assetId));
      }
      const prev = existing.rows[0] as AssetRow;

      // Soft-delete the metadata row
      await client.query(
        `UPDATE workspace_assets
            SET _archived_at = NOW(), _updated_at = NOW()
          WHERE id = $1`,
        [assetId],
      );

      // Decrement quota
      await client.query(
        `UPDATE workspaces
            SET assets_bytes_used = GREATEST(0, assets_bytes_used - $1),
                _updated_at = NOW()
          WHERE id = $2`,
        [Number(prev.size_bytes), workspaceId],
      );

      await client.query('COMMIT');

      // Delete blobs outside the transaction (not critical-path; logged on failure)
      await this.objectStorage.delete(prev.storage_key);
      if (prev.parsed_text_key) {
        await this.objectStorage.delete(prev.parsed_text_key);
      }

      return ok(undefined);
    } catch (cause) {
      await client.query('ROLLBACK').catch(() => undefined);
      return err(new AssetStorageError(`Delete failed: ${String(cause)}`));
    } finally {
      client.release();
    }
  }

  async listByCategory(
    workspaceId: string,
    topLevel: AssetTopLevel,
    category: AssetCategory,
  ): Promise<Result<WorkspaceAsset[], AssetStorageError>> {
    try {
      const result = await this.pool.query<AssetRow>(
        `SELECT * FROM workspace_assets
          WHERE workspace_id = $1
            AND top_level = $2
            AND category = $3
            AND _archived_at IS NULL
          ORDER BY _updated_at DESC`,
        [workspaceId, topLevel, category],
      );
      return ok(result.rows.map(rowToAsset));
    } catch (cause) {
      return err(new AssetStorageError(`listByCategory failed: ${String(cause)}`));
    }
  }

  async listByContext(
    workspaceId: string,
    context: StageAssetContext,
  ): Promise<Result<ContextualAsset[], AssetStorageError>> {
    try {
      // Build the category list from the context declaration
      const slots: Array<{ topLevel: AssetTopLevel; category: AssetCategory }> = [];
      if (context.brand) {
        for (const cat of context.brand) slots.push({ topLevel: 'brand', category: cat });
      }
      if (context.documents) {
        for (const cat of context.documents) slots.push({ topLevel: 'documents', category: cat });
      }

      if (slots.length === 0) return ok([]);

      // Fetch all matching categories in one query using unnest
      const topLevels = slots.map((s) => s.topLevel);
      const categories = slots.map((s) => s.category);

      const result = await this.pool.query<AssetRow>(
        `SELECT wa.*
           FROM workspace_assets wa
           JOIN UNNEST($1::text[], $2::text[]) AS ctx(tl, cat)
             ON wa.top_level = ctx.tl AND wa.category = ctx.cat
          WHERE wa.workspace_id = $3
            AND wa._archived_at IS NULL
          ORDER BY wa._updated_at DESC`,
        [topLevels, categories, workspaceId],
      );

      // For document assets, fetch parsed text from blob storage
      const contextualAssets: ContextualAsset[] = await Promise.all(
        result.rows.map(async (row): Promise<ContextualAsset> => {
          const asset = rowToAsset(row);
          let parsedText: string | null = null;
          if (asset.parsedTextKey) {
            const getResult = await this.objectStorage.get(asset.parsedTextKey);
            if (getResult.isOk()) {
              const chunks: Buffer[] = [];
              await new Promise<void>((resolve) => {
                getResult.value.on('data', (c: Buffer) => chunks.push(c));
                getResult.value.on('end', resolve);
                getResult.value.on('error', resolve);
              });
              parsedText = Buffer.concat(chunks).toString('utf8');
            }
          }
          return { ...asset, contextCategory: asset.category, parsedText };
        }),
      );

      return ok(contextualAssets);
    } catch (cause) {
      return err(new AssetStorageError(`listByContext failed: ${String(cause)}`));
    }
  }

  async getQuota(workspaceId: string): Promise<Result<WorkspaceAssetQuota, AssetStorageError>> {
    try {
      const result = await this.pool.query<{
        assets_bytes_used: string;
        assets_allowance_bytes: string;
      }>(
        `SELECT assets_bytes_used, assets_allowance_bytes
           FROM workspaces
          WHERE id = $1 AND _archived_at IS NULL`,
        [workspaceId],
      );
      if (result.rowCount === 0) {
        return err(new AssetStorageError(`Workspace '${workspaceId}' not found`));
      }
      const quotaData = result.rows[0] as Record<string, unknown>;
      return ok({
        workspaceId,
        usedBytes: Number(quotaData['assets_bytes_used']),
        allowanceBytes: Number(quotaData['assets_allowance_bytes']),
      });
    } catch (cause) {
      return err(new AssetStorageError(`getQuota failed: ${String(cause)}`));
    }
  }

  async findById(
    workspaceId: string,
    assetId: string,
  ): Promise<Result<WorkspaceAsset | null, AssetStorageError>> {
    try {
      const result = await this.pool.query<AssetRow>(
        `SELECT * FROM workspace_assets
          WHERE id = $1 AND workspace_id = $2 AND _archived_at IS NULL`,
        [assetId, workspaceId],
      );
      return ok(result.rows[0] ? rowToAsset(result.rows[0]) : null);
    } catch (cause) {
      return err(new AssetStorageError(`findById failed: ${String(cause)}`));
    }
  }

  async recordConsumedAssets(
    workspaceId: string,
    generationId: string,
    snapshot: ConsumedAssetSnapshot,
  ): Promise<Result<void, AssetStorageError>> {
    const entries = Object.entries(snapshot);
    if (entries.length === 0) return ok(undefined);

    try {
      // Upsert all entries for this generation in one statement
      const values: unknown[] = [];
      const placeholders = entries.map(([assetId, entry], i) => {
        const base = i * 7;
        values.push(
          generationId,
          assetId,
          workspaceId,
          entry.version,
          entry.category,
          entry.topLevel,
          entry.filename,
        );
        const b = base;
        return `($${String(b + 1)},$${String(b + 2)},$${String(b + 3)},$${String(b + 4)},$${String(b + 5)},$${String(b + 6)},$${String(b + 7)})`;
      });

      await this.pool.query(
        `INSERT INTO generation_asset_refs
           (generation_id, asset_id, workspace_id, asset_version, category, top_level, filename)
         VALUES ${placeholders.join(',')}
         ON CONFLICT (generation_id, asset_id)
         DO UPDATE SET
           asset_version = EXCLUDED.asset_version,
           category      = EXCLUDED.category,
           top_level     = EXCLUDED.top_level,
           filename      = EXCLUDED.filename,
           recorded_at   = NOW()`,
        values,
      );
      return ok(undefined);
    } catch (cause) {
      return err(new AssetStorageError(`recordConsumedAssets failed: ${String(cause)}`));
    }
  }

  async checkStaleness(
    workspaceId: string,
    snapshot: ConsumedAssetSnapshot,
  ): Promise<Result<StalenessCheck, AssetStorageError>> {
    const assetIds = Object.keys(snapshot);
    if (assetIds.length === 0) return ok({ isStale: false, staleAssets: [] });

    try {
      const result = await this.pool.query<{ id: string; _version: number }>(
        `SELECT id, _version
           FROM workspace_assets
          WHERE id = ANY($1::uuid[])
            AND workspace_id = $2
            AND _archived_at IS NULL`,
        [assetIds, workspaceId],
      );

      const currentVersions = new Map(result.rows.map((r) => [r.id, r._version]));
      const staleAssets: StaleAssetEntry[] = [];

      for (const [assetId, entry] of Object.entries(snapshot)) {
        const currentVersion = currentVersions.get(assetId);
        if (currentVersion === undefined) {
          // Asset was deleted — treat as stale (it was there at generation time)
          staleAssets.push({
            assetId,
            category: entry.category,
            filename: entry.filename,
            previousVersion: entry.version,
            currentVersion: 0,
          });
        } else if (currentVersion !== entry.version) {
          staleAssets.push({
            assetId,
            category: entry.category,
            filename: entry.filename,
            previousVersion: entry.version,
            currentVersion,
          });
        }
      }

      return ok({ isStale: staleAssets.length > 0, staleAssets });
    } catch (cause) {
      return err(new AssetStorageError(`checkStaleness failed: ${String(cause)}`));
    }
  }

  // ── Internal helpers ──────────────────────────────────────────────────────────

  private async _validateAndParse(
    blobKey: string,
    mimeType: string,
    sizeBytes: number,
    topLevel: AssetTopLevel,
    category: AssetCategory,
  ): Promise<{
    parsedTextKey: string | null;
    validationStatus: AssetValidationStatus;
    validationReason: string | null;
  }> {
    // Image format check (SVG, PNG, JPG, WebP, AVIF accepted)
    const imageMimes = new Set([
      'image/svg+xml',
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/avif',
    ]);
    // Font format check (woff2 preferred, woff/ttf/otf accepted)
    const fontMimes = new Set([
      'font/woff2',
      'font/woff',
      'font/ttf',
      'font/otf',
      'application/font-woff2',
      'application/font-woff',
    ]);

    // Image size check: > 10 MB is invalid
    const maxImageBytes = 10 * 1024 * 1024;

    if (imageMimes.has(mimeType)) {
      if (sizeBytes > maxImageBytes) {
        return {
          parsedTextKey: null,
          validationStatus: 'invalid',
          validationReason: `Image exceeds 10 MB limit (${String(sizeBytes)} bytes)`,
        };
      }
      return { parsedTextKey: null, validationStatus: 'valid', validationReason: null };
    }

    if (fontMimes.has(mimeType)) {
      return { parsedTextKey: null, validationStatus: 'valid', validationReason: null };
    }

    // Color asset WCAG AA check — brand/colors stored as JSON
    if (topLevel === 'brand' && category === 'colors' && mimeType === 'application/json') {
      const wcagResult = await this._checkColorWcag(blobKey);
      return {
        parsedTextKey: null,
        validationStatus: wcagResult.pass ? 'valid' : 'invalid',
        validationReason: wcagResult.reason ?? null,
      };
    }

    // Document parsing
    const parsedTextKey = await this._extractDocumentText(blobKey, mimeType);
    if (parsedTextKey === null) {
      // Unsupported format — stored but not parseable
      return {
        parsedTextKey: null,
        validationStatus: 'unsupported_format',
        validationReason: `MIME type '${mimeType}' is not parseable for AI context`,
      };
    }
    return { parsedTextKey, validationStatus: 'valid', validationReason: null };
  }

  /**
   * Check all colors in a brand color JSON asset for WCAG 2.1 AA compliance.
   * Each color must achieve ≥ 4.5:1 contrast against white or black to pass.
   * Colors that fail are listed in the reason string.
   *
   * Expected JSON shape (array or object values):
   *   [{ role, hex, rgb: [r, g, b] }, ...]
   *   or { primary: { hex, rgb: [r, g, b] }, ... }
   */
  private async _checkColorWcag(blobKey: string): Promise<{ pass: boolean; reason?: string }> {
    try {
      const getResult = await this.objectStorage.get(blobKey);
      if (getResult.isErr()) return { pass: true }; // can't read — don't block

      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        getResult.value.on('data', (c: Buffer) => chunks.push(c));
        getResult.value.on('end', resolve);
        getResult.value.on('error', reject);
      });

      const json: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const entries: Array<{ role: string; rgb: [number, number, number] }> = [];

      const extractRgb = (value: unknown, role: string): void => {
        if (typeof value !== 'object' || value === null) return;
        const v = value as Record<string, unknown>;
        if (Array.isArray(v['rgb']) && v['rgb'].length === 3) {
          const [r, g, b] = v['rgb'] as [number, number, number];
          if ([r, g, b].every((x) => typeof x === 'number')) {
            entries.push({ role, rgb: [r, g, b] });
          }
        } else if (typeof v['hex'] === 'string') {
          const rgb = hexToRgb(v['hex']);
          if (rgb) entries.push({ role, rgb });
        }
      };

      if (Array.isArray(json)) {
        for (const item of json as unknown[]) {
          const el = item as Record<string, unknown>;
          extractRgb(el, typeof el['role'] === 'string' ? el['role'] : 'unknown');
        }
      } else if (typeof json === 'object' && json !== null) {
        for (const [key, value] of Object.entries(json as Record<string, unknown>)) {
          extractRgb(value, key);
        }
      }

      if (entries.length === 0) return { pass: true }; // no parseable colors — don't block

      const failing: string[] = [];
      for (const { role, rgb } of entries) {
        const ratio = wcagMaxContrastRatio(rgb);
        if (ratio < 4.5) {
          failing.push(`${role} (max contrast ${ratio.toFixed(2)}:1 < 4.5:1)`);
        }
      }

      if (failing.length === 0) return { pass: true };
      return {
        pass: false,
        reason: `WCAG AA failure — these colors do not achieve 4.5:1 contrast against white or black: ${failing.join(', ')}`,
      };
    } catch {
      return { pass: true }; // parse errors don't block upload
    }
  }

  private async _extractDocumentText(blobKey: string, mimeType: string): Promise<string | null> {
    const supportedDocMimes = new Set([
      'text/plain',
      'text/markdown',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);

    if (!supportedDocMimes.has(mimeType)) return null;

    try {
      const getResult = await this.objectStorage.get(blobKey);
      if (getResult.isErr()) return null;

      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        getResult.value.on('data', (c: Buffer) => chunks.push(c));
        getResult.value.on('end', resolve);
        getResult.value.on('error', reject);
      });
      const buf = Buffer.concat(chunks);

      let text: string;

      if (mimeType === 'text/plain') {
        text = buf.toString('utf8');
      } else if (mimeType === 'text/markdown') {
        // Strip YAML frontmatter if present, keep body
        text = buf
          .toString('utf8')
          .replace(/^---[\s\S]*?---\n?/, '')
          .trim();
      } else if (mimeType === 'application/pdf') {
        // Dynamic import — pdf-parse is an optional peer dep without bundled types
        const pdfMod = (await import('pdf-parse' as string).catch(() => null)) as {
          default: (buf: Buffer) => Promise<{ text: string }>;
        } | null;
        if (!pdfMod) return null;
        const data = await pdfMod.default(buf);
        text = data.text;
      } else {
        // DOCX — mammoth is an optional peer dep without bundled types
        const mammoth = (await import('mammoth' as string).catch(() => null)) as {
          extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
        } | null;
        if (!mammoth) return null;
        const result = await mammoth.extractRawText({ buffer: buf });
        text = result.value;
      }

      const parsedKey = `${blobKey}.parsed.txt`;
      await this.objectStorage.put(parsedKey, Buffer.from(text, 'utf8'), {
        contentType: 'text/plain',
      });
      return parsedKey;
    } catch {
      return null;
    }
  }
}
