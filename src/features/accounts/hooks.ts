import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type AccountInsert,
  type AccountUpdate,
  createAccount,
  fetchAccount,
  fetchAccountBalances,
  fetchBalanceAsOf,
  fetchAccounts,
  reorderAccounts,
  updateAccount,
} from './api';

// 口座に関わるクエリはすべて 'accounts' から始め、変更後にまとめて再取得する
export const accountKeys = {
  all: ['accounts'] as const,
  list: () => [...accountKeys.all, 'list'] as const,
  balances: () => [...accountKeys.all, 'balances'] as const,
  detail: (id: string) => [...accountKeys.all, 'detail', id] as const,
  balanceAsOf: (id: string, date: string) => [...accountKeys.all, 'balanceAsOf', id, date] as const,
};

export function useAccountBalances() {
  return useQuery({ queryKey: accountKeys.balances(), queryFn: fetchAccountBalances });
}

export function useAccounts() {
  return useQuery({ queryKey: accountKeys.list(), queryFn: fetchAccounts });
}

export function useAccount(id: string | undefined) {
  return useQuery({
    queryKey: accountKeys.detail(id ?? ''),
    queryFn: () => fetchAccount(id!),
    enabled: !!id,
  });
}

export function useBalanceAsOf(id: string, date: string) {
  return useQuery({ queryKey: accountKeys.balanceAsOf(id, date), queryFn: () => fetchBalanceAsOf(id, date) });
}

function useInvalidateAccounts() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: accountKeys.all });
}

export function useCreateAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (values: AccountInsert) => createAccount(values),
    onSuccess: invalidate,
  });
}

export function useUpdateAccount() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: AccountUpdate }) => updateAccount(id, values),
    onSuccess: invalidate,
  });
}

export function useReorderAccounts() {
  const invalidate = useInvalidateAccounts();
  return useMutation({
    mutationFn: (orderedIds: string[]) => reorderAccounts(orderedIds),
    onSettled: invalidate,
  });
}
