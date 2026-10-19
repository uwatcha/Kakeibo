import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { deleteAiKey, fetchAiStatus, fetchAiUsageToday, saveAiKey, setAiModel } from './api';

export const aiKeys = {
  all: ['ai'] as const,
  status: () => [...aiKeys.all, 'status'] as const,
  usage: (today: string) => [...aiKeys.all, 'usage', today] as const,
};

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
