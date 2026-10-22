import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { EmailSource } from '../../../supabase/functions/_shared/emailParse';
import {
  addDuplicateImport,
  deletePayeeRule,
  dismissImport,
  fetchAutoAdded,
  fetchEmailImportSettings,
  fetchEmailImportSources,
  fetchNeedsPayee,
  fetchOpenImports,
  fetchPayeeRules,
  markReviewed,
  rotateEmailImportToken,
  saveEmailImportSource,
  saveSummaryRules,
  updatePayeeRule,
} from './api';

// 記録を変えたときにも読み直したいもの（自動で追加・内容の入力）は ['transactions'] の下に置く
export const emailImportKeys = {
  all: ['emailImport'] as const,
  settings: () => [...emailImportKeys.all, 'settings'] as const,
  sources: () => [...emailImportKeys.all, 'sources'] as const,
  rules: () => [...emailImportKeys.all, 'rules'] as const,
  open: () => [...emailImportKeys.all, 'open'] as const,
  autoAdded: () => ['transactions', 'autoAdded'] as const,
  needsPayee: () => ['transactions', 'needsPayee'] as const,
};

function useInvalidate() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: emailImportKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['accounts'] }),
      queryClient.invalidateQueries({ queryKey: ['reports'] }),
    ]);
}

export const useEmailImportSettings = () =>
  useQuery({ queryKey: emailImportKeys.settings(), queryFn: fetchEmailImportSettings });
export const useEmailImportSources = () =>
  useQuery({ queryKey: emailImportKeys.sources(), queryFn: fetchEmailImportSources });
export const usePayeeRules = () => useQuery({ queryKey: emailImportKeys.rules(), queryFn: fetchPayeeRules });
export const useOpenImports = () => useQuery({ queryKey: emailImportKeys.open(), queryFn: fetchOpenImports });
export const useAutoAdded = () => useQuery({ queryKey: emailImportKeys.autoAdded(), queryFn: fetchAutoAdded });
export const useNeedsPayee = () => useQuery({ queryKey: emailImportKeys.needsPayee(), queryFn: fetchNeedsPayee });

export function useRotateToken() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: rotateEmailImportToken, onSuccess: invalidate });
}

export function useSaveSummaryRules() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: saveSummaryRules, onSuccess: invalidate });
}

export function useSaveEmailImportSource() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { source: EmailSource; enabled: boolean; accountId: string | null }) =>
      saveEmailImportSource(input.source, input),
    onSuccess: invalidate,
  });
}

export function useUpdatePayeeRule() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: { rawPayee: string; payee: string | null; categoryId: string | null }) =>
      updatePayeeRule(input.rawPayee, input),
    onSuccess: invalidate,
  });
}

export function useDeletePayeeRule() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: deletePayeeRule, onSuccess: invalidate });
}

export function useDismissImport() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: dismissImport, onSuccess: invalidate });
}

export function useAddDuplicateImport() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: addDuplicateImport, onSuccess: invalidate });
}

export function useMarkReviewed() {
  const invalidate = useInvalidate();
  return useMutation({ mutationFn: markReviewed, onSuccess: invalidate });
}
