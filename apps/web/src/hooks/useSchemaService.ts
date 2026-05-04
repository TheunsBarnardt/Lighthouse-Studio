import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CreateSchemaInput, CustomerSchema, TableDefinition } from '@/lib/types';

import { schemaApi } from '@/lib/api-client';

export const schemaKeys = {
  all: (workspaceId: string) => ['schemas', workspaceId] as const,
  detail: (workspaceId: string, schemaId: string) => ['schemas', workspaceId, schemaId] as const,
  versions: (workspaceId: string, schemaId: string) =>
    ['schemas', workspaceId, schemaId, 'versions'] as const,
};

export function useListSchemas(workspaceId: string) {
  return useQuery({
    queryKey: schemaKeys.all(workspaceId),
    queryFn: () => schemaApi.list(workspaceId),
  });
}

export function useGetSchema(workspaceId: string, schemaId: string) {
  return useQuery({
    queryKey: schemaKeys.detail(workspaceId, schemaId),
    queryFn: () => schemaApi.get(workspaceId, schemaId),
    enabled: Boolean(workspaceId) && Boolean(schemaId),
  });
}

export function useListVersions(workspaceId: string, schemaId: string) {
  return useQuery({
    queryKey: schemaKeys.versions(workspaceId, schemaId),
    queryFn: () => schemaApi.listVersions(workspaceId, schemaId),
    enabled: Boolean(workspaceId) && Boolean(schemaId),
  });
}

export function useCreateSchema(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSchemaInput) => schemaApi.create(workspaceId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: schemaKeys.all(workspaceId) });
    },
  });
}

export function useRollback(workspaceId: string, schemaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetVersion: number) => schemaApi.rollback(workspaceId, schemaId, targetVersion),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: schemaKeys.detail(workspaceId, schemaId) });
      void queryClient.invalidateQueries({ queryKey: schemaKeys.versions(workspaceId, schemaId) });
    },
  });
}

export function useUpdateSchema(workspaceId: string, schemaId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      expectedVersion,
      tables,
    }: {
      expectedVersion: number;
      tables: TableDefinition[];
    }) => schemaApi.update(workspaceId, { schemaId, expectedVersion, changes: { tables } }),
    onSuccess: (updated: CustomerSchema) => {
      queryClient.setQueryData(schemaKeys.detail(workspaceId, schemaId), updated);
    },
  });
}

export function useExportSchema(workspaceId: string, schemaId: string) {
  return useMutation({
    mutationFn: () => schemaApi.exportSchema(workspaceId, schemaId, 'json'),
  });
}

export function useImportSchema(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof schemaApi.importSchema>[1]) =>
      schemaApi.importSchema(workspaceId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: schemaKeys.all(workspaceId) });
    },
  });
}
