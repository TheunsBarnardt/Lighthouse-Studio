/**
 * Zustand store for the schema designer.
 * Single source of truth: all three views (Diagram, Table, Code) read from and write to this store.
 * Every mutation goes through updateSchema() so the sync invariant can never be broken.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import type {
  CustomerSchema,
  MigrationPreview,
  SchemaChanges,
  TableDefinition,
  ValidationReport,
} from '@/lib/types';

import { ApiClientError, schemaApi } from '@/lib/api-client';

export type DesignerView = 'diagram' | 'table' | 'code';

export interface DesignerState {
  // Active workspace context (set at app boot)
  workspaceId: string | null;

  // Schema state
  schema: CustomerSchema | null;
  deployed: CustomerSchema | null; // last deployed version snapshot
  isDirty: boolean;

  // UI state
  selectedTableId: string | null;
  selectedView: DesignerView;

  // Operation results
  validationReport: ValidationReport | null;
  migrationPreview: MigrationPreview | null;

  // Loading / error state
  isLoading: boolean;
  error: string | null;

  // Conflict state (set when 409 is returned during deploy)
  conflictSchema: CustomerSchema | null;

  // ── Actions ──────────────────────────────────────────────────────────────

  /** Set the active workspace. Must be called before any schema operations. */
  setWorkspaceId: (id: string) => void;

  /** Load a schema from the API and populate store. */
  loadSchema: (schemaId: string) => Promise<void>;

  /** Replace the current schema (deep merge-safe via immer). Marks dirty. */
  updateSchema: (mutate: (schema: CustomerSchema) => void) => void;

  /** Replace tables array wholesale (used by Code view on parse). */
  setTables: (tables: TableDefinition[]) => void;

  /** Select a table to focus in Table/Diagram views. */
  selectTable: (tableId: string | null) => void;

  /** Switch between the three views. */
  changeView: (view: DesignerView) => void;

  /** Run validation against the API. */
  validateChanges: () => Promise<void>;

  /** Preview the migration plan. Requires validation to pass first. */
  previewMigration: () => Promise<void>;

  /** Apply the migration. Clears dirty flag on success. */
  applyMigration: () => Promise<void>;

  /** Roll back to a prior version. */
  rollback: (targetVersion: number) => Promise<void>;

  /** Reset unsaved changes back to the deployed version. */
  resetToDeployed: () => void;

  /** Clear validation and migration results (e.g. after editing). */
  clearResults: () => void;

  /** Reset error state. */
  clearError: () => void;

  /** Dismiss the conflict modal without resolving. */
  dismissConflict: () => void;

  /**
   * Resolve a deploy conflict.
   * 'discard' - reset to the server's current version (lose local changes).
   * 'overwrite' - force-apply local changes ignoring the server version.
   */
  resolveConflict: (strategy: 'discard' | 'overwrite') => Promise<void>;
}

export const useDesignerStore = create<DesignerState>()(
  immer((set, get) => ({
    workspaceId: null,
    schema: null,
    deployed: null,
    isDirty: false,
    selectedTableId: null,
    selectedView: 'diagram',
    validationReport: null,
    migrationPreview: null,
    isLoading: false,
    error: null,
    conflictSchema: null,

    setWorkspaceId(id) {
      set((s) => {
        s.workspaceId = id;
      });
    },

    async loadSchema(schemaId) {
      const { workspaceId } = get();
      if (!workspaceId) {
        set((s) => {
          s.error = 'No workspace selected.';
        });
        return;
      }
      set((s) => {
        s.isLoading = true;
        s.error = null;
      });
      try {
        const schema = await schemaApi.get(workspaceId, schemaId);
        set((s) => {
          s.schema = schema;
          s.deployed = schema;
          s.isDirty = false;
          s.validationReport = null;
          s.migrationPreview = null;
        });
      } catch (err) {
        set((s) => {
          s.error = err instanceof Error ? err.message : 'Failed to load schema.';
        });
      } finally {
        set((s) => {
          s.isLoading = false;
        });
      }
    },

    updateSchema(mutate) {
      set((s) => {
        if (!s.schema) return;
        mutate(s.schema);
        s.isDirty = true;
        // Clear stale results whenever the schema changes
        s.validationReport = null;
        s.migrationPreview = null;
      });
    },

    setTables(tables) {
      set((s) => {
        if (!s.schema) return;
        s.schema.tables = tables;
        s.isDirty = true;
        s.validationReport = null;
        s.migrationPreview = null;
      });
    },

    selectTable(tableId) {
      set((s) => {
        s.selectedTableId = tableId;
      });
    },

    changeView(view) {
      set((s) => {
        s.selectedView = view;
      });
    },

    async validateChanges() {
      const { workspaceId, schema } = get();
      if (!workspaceId || !schema) return;
      set((s) => {
        s.isLoading = true;
        s.error = null;
      });
      try {
        const changes: SchemaChanges = { tables: schema.tables };
        const report = await schemaApi.validate(workspaceId, schema.id, changes);
        set((s) => {
          s.validationReport = report;
        });
      } catch (err) {
        set((s) => {
          s.error = err instanceof Error ? err.message : 'Validation failed.';
        });
      } finally {
        set((s) => {
          s.isLoading = false;
        });
      }
    },

    async previewMigration() {
      const { workspaceId, schema } = get();
      if (!workspaceId || !schema) return;
      set((s) => {
        s.isLoading = true;
        s.error = null;
      });
      try {
        const changes: SchemaChanges = { tables: schema.tables };
        const preview = await schemaApi.previewMigration(workspaceId, schema.id, changes);
        set((s) => {
          s.migrationPreview = preview;
        });
      } catch (err) {
        set((s) => {
          s.error = err instanceof Error ? err.message : 'Preview failed.';
        });
      } finally {
        set((s) => {
          s.isLoading = false;
        });
      }
    },

    async applyMigration() {
      const { workspaceId, schema } = get();
      if (!workspaceId || !schema) return;
      set((s) => {
        s.isLoading = true;
        s.error = null;
      });
      try {
        const changes: SchemaChanges = { tables: schema.tables };
        const result = await schemaApi.applyMigration(
          workspaceId,
          schema.id,
          changes,
          schema.version,
        );
        if (result.outcome === 'succeeded' && result.newVersion !== undefined) {
          const newVersion = result.newVersion;
          set((s) => {
            if (!s.schema) return;
            s.schema.version = newVersion;
            s.schema.metadata.lastDeployedAt = result.completedAt;
            s.schema.metadata.deployedVersion = newVersion;
            s.deployed = s.schema;
            s.isDirty = false;
            s.migrationPreview = null;
          });
        } else {
          set((s) => {
            s.error = result.errorMessage ?? 'Migration failed.';
          });
        }
      } catch (err) {
        if (err instanceof ApiClientError && err.statusCode === 409) {
          // Version mismatch — another client deployed while we were editing.
          const serverSchema = err.metadata['currentSchema'] as CustomerSchema | undefined;
          set((s) => {
            s.conflictSchema = serverSchema ?? null;
            s.error = null;
          });
        } else {
          set((s) => {
            s.error = err instanceof Error ? err.message : 'Apply migration failed.';
          });
        }
      } finally {
        set((s) => {
          s.isLoading = false;
        });
      }
    },

    async rollback(targetVersion) {
      const { workspaceId, schema } = get();
      if (!workspaceId || !schema) return;
      set((s) => {
        s.isLoading = true;
        s.error = null;
      });
      try {
        await schemaApi.rollback(workspaceId, schema.id, targetVersion);
        // Reload fresh state from API
        await get().loadSchema(schema.id);
      } catch (err) {
        set((s) => {
          s.error = err instanceof Error ? err.message : 'Rollback failed.';
        });
        set((s) => {
          s.isLoading = false;
        });
      }
    },

    resetToDeployed() {
      const { deployed } = get();
      if (!deployed) return;
      set((s) => {
        s.schema = deployed;
        s.isDirty = false;
        s.validationReport = null;
        s.migrationPreview = null;
        s.error = null;
      });
    },

    clearResults() {
      set((s) => {
        s.validationReport = null;
        s.migrationPreview = null;
      });
    },

    clearError() {
      set((s) => {
        s.error = null;
      });
    },

    dismissConflict() {
      set((s) => {
        s.conflictSchema = null;
      });
    },

    async resolveConflict(strategy) {
      const { workspaceId, schema, conflictSchema } = get();
      set((s) => {
        s.conflictSchema = null;
      });

      if (strategy === 'discard') {
        if (!workspaceId || !conflictSchema) return;
        set((s) => {
          s.schema = conflictSchema;
          s.deployed = conflictSchema;
          s.isDirty = false;
          s.validationReport = null;
          s.migrationPreview = null;
        });
        return;
      }

      // 'overwrite': bump our version to match the server's, then re-apply
      if (!workspaceId || !schema || !conflictSchema) return;
      set((s) => {
        if (s.schema) s.schema.version = conflictSchema.version;
      });
      await get().applyMigration();
    },
  })),
);

// Typed selectors for common derived state

export const selectCanDeploy = (s: DesignerState) =>
  s.isDirty && s.validationReport?.valid === true && s.migrationPreview !== null && !s.isLoading;

export const selectHasErrors = (s: DesignerState) => (s.validationReport?.errors.length ?? 0) > 0;

export const selectTableById = (tableId: string) => (s: DesignerState) =>
  s.schema?.tables.find((t) => t.id === tableId);
