import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toTokyoDateString } from '@/lib/date';

import {
  createRule,
  deleteGeneratedTransactions,
  deleteRule,
  fetchGeneratedTransactions,
  fetchRules,
  generateDueTransactions,
  type RecurringRuleInsert,
  type RecurringRuleUpdate,
  setRuleActive,
  updateRule,
} from './api';

export const recurringKeys = {
  all: ['recurring'] as const,
  list: () => [...recurringKeys.all, 'list'] as const,
  generated: (ruleId: string) => [...recurringKeys.all, 'generated', ruleId] as const,
};

export function useRules() {
  return useQuery({ queryKey: recurringKeys.list(), queryFn: fetchRules });
}

export function useGeneratedTransactions(ruleId: string | undefined) {
  return useQuery({
    queryKey: recurringKeys.generated(ruleId ?? ''),
    queryFn: () => fetchGeneratedTransactions(ruleId!),
    enabled: !!ruleId,
  });
}

/** 記録が増減すると残高・一覧・集計がすべて変わるので、まとめて再取得する */
export function useRefreshAfterRecurringChange() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries();
}

/** ルールの変更を保存し、そのまま期日の来た回を追加する */
export function useSaveRule() {
  const refresh = useRefreshAfterRecurringChange();
  return useMutation({
    mutationFn: async (input: { id: string | null; values: RecurringRuleInsert | RecurringRuleUpdate }) => {
      const today = toTokyoDateString();
      if (input.id) await updateRule(input.id, input.values, today);
      else await createRule(input.values as RecurringRuleInsert);
      await generateDueTransactions(today);
    },
    onSuccess: refresh,
  });
}

export function useSetRuleActive() {
  const refresh = useRefreshAfterRecurringChange();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const today = toTokyoDateString();
      await setRuleActive(id, isActive, today);
      await generateDueTransactions(today);
    },
    onSuccess: refresh,
  });
}

export function useDeleteGenerated() {
  const refresh = useRefreshAfterRecurringChange();
  return useMutation({ mutationFn: (ruleId: string) => deleteGeneratedTransactions(ruleId), onSuccess: refresh });
}

export function useDeleteRule() {
  const refresh = useRefreshAfterRecurringChange();
  return useMutation({ mutationFn: (id: string) => deleteRule(id), onSuccess: refresh });
}
