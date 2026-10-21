import { loadPending } from './pendingSend';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  deleteAiKey,
  deleteConversation,
  fetchAiStatus,
  fetchAiUsageToday,
  fetchConversation,
  fetchConversations,
  saveAiKey,
  setAiModel,
  setConversationPinned,
} from './api';
import { deletionCutoff } from './retention';

export const aiKeys = {
  all: ['ai'] as const,
  status: () => [...aiKeys.all, 'status'] as const,
  usage: (today: string) => [...aiKeys.all, 'usage', today] as const,
  conversations: () => [...aiKeys.all, 'conversations'] as const,
  conversation: (id: string) => [...aiKeys.all, 'conversations', id] as const,
  pending: () => [...aiKeys.all, 'pending'] as const,
};

/** 混み合いで送れず、送り直しを待っている質問（端末に置いてある） */
export function usePendingSends() {
  return useQuery({ queryKey: aiKeys.pending(), queryFn: loadPending });
}

export function useAiStatus() {
  return useQuery({ queryKey: aiKeys.status(), queryFn: fetchAiStatus });
}

export function useAiUsageToday(today: string) {
  return useQuery({ queryKey: aiKeys.usage(today), queryFn: () => fetchAiUsageToday(today) });
}

function useSetStatus() {
  const queryClient = useQueryClient();
  return (status: Awaited<ReturnType<typeof fetchAiStatus>>) => queryClient.setQueryData(aiKeys.status(), status);
}

export function useSaveAiKey() {
  const setStatus = useSetStatus();
  return useMutation({ mutationFn: saveAiKey, onSuccess: setStatus });
}

export function useDeleteAiKey() {
  const setStatus = useSetStatus();
  return useMutation({ mutationFn: deleteAiKey, onSuccess: setStatus });
}

export function useSetAiModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setAiModel,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: aiKeys.status() }),
  });
}

/** 会話の一覧。開くたびに、期限が過ぎたピン留めなしの会話を消してから読む */
export function useConversations() {
  return useQuery({ queryKey: aiKeys.conversations(), queryFn: () => fetchConversations(deletionCutoff(new Date())) });
}

export function useConversation(id: string | undefined) {
  return useQuery({
    queryKey: aiKeys.conversation(id ?? ''),
    queryFn: () => fetchConversation(id!),
    enabled: !!id,
  });
}

export function useSetConversationPinned() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => setConversationPinned(id, pinned),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: aiKeys.conversations() }),
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteConversation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: aiKeys.conversations() }),
  });
}
