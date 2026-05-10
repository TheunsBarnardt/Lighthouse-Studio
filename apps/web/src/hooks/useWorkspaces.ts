import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { conversationApi, workspaceApi } from '@/lib/api-client';

export const workspaceKeys = {
  list: () => ['workspaces'] as const,
};

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; slug: string }) => workspaceApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
}

export const conversationKeys = {
  list: (workspaceId: string) => ['conversations', workspaceId] as const,
};

export function useMyWorkspaces() {
  return useQuery({
    queryKey: workspaceKeys.list(),
    queryFn: () => workspaceApi.list(),
  });
}

export function useListConversations(workspaceId: string | undefined) {
  return useQuery({
    queryKey: conversationKeys.list(workspaceId ?? ''),
    queryFn: () => conversationApi.list(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
}

export function useStartConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, templateId }: { workspaceId: string; templateId?: string }) =>
      conversationApi.start(workspaceId, templateId),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: conversationKeys.list(vars.workspaceId) });
    },
  });
}
