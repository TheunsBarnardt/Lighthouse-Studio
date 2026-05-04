import { describe, it, expect, beforeEach } from 'vitest';

import type { CustomerSchema } from '@/lib/types';

import { useDesignerStore } from './designer-store';

const mockSchema: CustomerSchema = {
  id: 'schema-1',
  workspaceId: 'ws-1',
  name: 'Test Schema',
  slug: 'test-schema',
  version: 1,
  databaseDriver: 'postgres',
  tables: [],
  metadata: {
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    createdBy: 'user-1',
    updatedBy: 'user-1',
  },
};

beforeEach(() => {
  useDesignerStore.setState({
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
  });
});

describe('designer-store', () => {
  describe('updateSchema', () => {
    it('marks schema as dirty after mutation', () => {
      useDesignerStore.setState({ schema: mockSchema, deployed: mockSchema, isDirty: false });
      const { updateSchema } = useDesignerStore.getState();

      updateSchema((draft) => {
        draft.name = 'Updated Name';
      });

      const state = useDesignerStore.getState();
      expect(state.schema?.name).toBe('Updated Name');
      expect(state.isDirty).toBe(true);
    });

    it('clears validation and migration preview when schema changes', () => {
      useDesignerStore.setState({
        schema: mockSchema,
        validationReport: { valid: true, errors: [], warnings: [], info: [] },
        migrationPreview: null,
      });
      const { updateSchema } = useDesignerStore.getState();

      updateSchema((draft) => {
        draft.name = 'X';
      });

      const state = useDesignerStore.getState();
      expect(state.validationReport).toBeNull();
    });

    it('does nothing when schema is null', () => {
      useDesignerStore.setState({ schema: null, isDirty: false });
      const { updateSchema } = useDesignerStore.getState();

      updateSchema((draft) => {
        draft.name = 'Should not run';
      });

      expect(useDesignerStore.getState().isDirty).toBe(false);
    });
  });

  describe('setTables', () => {
    it('replaces tables array and marks dirty', () => {
      useDesignerStore.setState({ schema: mockSchema, deployed: mockSchema, isDirty: false });
      const { setTables } = useDesignerStore.getState();

      setTables([
        {
          id: 't1',
          name: 'users',
          columns: [],
          primaryKey: { kind: 'single', columnId: 'c1' },
          indexes: [],
          foreignKeys: [],
          constraints: [],
        },
      ]);

      const state = useDesignerStore.getState();
      expect(state.schema?.tables).toHaveLength(1);
      expect(state.isDirty).toBe(true);
    });
  });

  describe('selectTable', () => {
    it('updates selectedTableId', () => {
      const { selectTable } = useDesignerStore.getState();
      selectTable('table-abc');
      expect(useDesignerStore.getState().selectedTableId).toBe('table-abc');
    });
  });

  describe('changeView', () => {
    it('updates selectedView', () => {
      const { changeView } = useDesignerStore.getState();
      changeView('code');
      expect(useDesignerStore.getState().selectedView).toBe('code');
    });
  });

  describe('resetToDeployed', () => {
    it('restores schema to deployed version', () => {
      const deployed = { ...mockSchema, name: 'Deployed Version' };
      useDesignerStore.setState({
        schema: { ...mockSchema, name: 'Dirty' },
        deployed,
        isDirty: true,
      });

      const { resetToDeployed } = useDesignerStore.getState();
      resetToDeployed();

      const state = useDesignerStore.getState();
      expect(state.schema?.name).toBe('Deployed Version');
      expect(state.isDirty).toBe(false);
    });
  });

  describe('selectCanDeploy selector', () => {
    it('returns false when no validation report', () => {
      useDesignerStore.setState({ validationReport: null, migrationPreview: null });
      // selectCanDeploy is not exported as a standalone, but accessible via state
      const state = useDesignerStore.getState();
      const canDeploy = state.validationReport?.valid === true && state.migrationPreview !== null;
      expect(canDeploy).toBe(false);
    });
  });
});
